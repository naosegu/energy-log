// DynamoDB と通信するための基本クライアント
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
// DynamoDB を扱いやすい形で使うための高レベル API
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

// Lambda の再利用時に使い回せるよう、DynamoDB クライアントは関数の外で初期化する
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// 保存先テーブル名は CDK 側から環境変数で渡す
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath;

  try {
    // ルートパスは疎通確認用として残しておく
    if (method === 'GET' && path === '/') {
      return jsonResponse(200, {
        message: 'Energy Log API is working',
        method,
        path,
      });
    }

    // 1件のログを作成して DynamoDB に保存する
    if (method === 'POST' && path === '/logs') {
      const body = JSON.parse(event.body ?? '{}');
      const validationError = validateLogInput(body);
      if (validationError) {
        return jsonResponse(400, {
          message: validationError,
        });
      }

      const anonId = event.headers?.['x-anon-id'] || 'demo-user';

      const now = new Date();
      const createdAt = now.toISOString();
      // TTL 用に 180 日後の Unix time を保存する
      const expireAt = Math.floor(
        new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).getTime() / 1000
      );

      // 同じ日の同じ種類は 3 件までに制限する
      const existingLogs = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'anonId = :anonId',
          ExpressionAttributeValues: {
            ':anonId': anonId,
          },
          ScanIndexForward: false,
          Limit: 20,
        })
      );

      const todayKey = toDateKey(now);
      const sameTypeCountToday = (existingLogs.Items ?? []).filter((item) => {
        return toDateKey(new Date(item.createdAt)) === todayKey && item.type === body.type;
      }).length;

      if (sameTypeCountToday >= 3) {
        return jsonResponse(429, {
          message: `${body.type} logs are limited to 3 per day`,
        });
      }

      const item = {
        // いまは匿名ユーザー ID をヘッダで受け取る
        anonId,
        createdAt,
        type: body.type,
        title: body.title,
        value: body.value,
        expireAt,
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );

      return jsonResponse(201, {
        message: 'log created',
        item,
      });
    }

    // 匿名ユーザー ID ごとの最新ログを新しい順で返す
    if (method === 'GET' && path === '/logs') {
      const anonId = event.headers?.['x-anon-id'] || 'demo-user';

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'anonId = :anonId',
          ExpressionAttributeValues: {
            ':anonId': anonId,
          },
          ScanIndexForward: false,
          Limit: 20,
        })
      );

      return jsonResponse(200, {
        items: result.Items ?? [],
      });
    }

    // 既存ログの type / title / value を更新する
    if (method === 'PUT' && path === '/logs') {
      const body = JSON.parse(event.body ?? '{}');
      if (typeof body.createdAt !== 'string' || !body.createdAt.trim()) {
        return jsonResponse(400, {
          message: 'createdAt is required',
        });
      }

      const validationError = validateLogInput(body);
      if (validationError) {
        return jsonResponse(400, {
          message: validationError,
        });
      }

      const anonId = event.headers?.['x-anon-id'] || 'demo-user';

      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: {
            anonId,
            createdAt: body.createdAt,
          },
          UpdateExpression: 'SET #type = :type, title = :title, #value = :value',
          ExpressionAttributeNames: {
            '#type': 'type',
            '#value': 'value',
          },
          ExpressionAttributeValues: {
            ':type': body.type,
            ':title': body.title,
            ':value': body.value,
          },
          ReturnValues: 'ALL_NEW',
        })
      );

      return jsonResponse(200, {
        message: 'log updated',
        item: result.Attributes,
      });
    }

    // 既存ログを 1 件削除する
    if (method === 'DELETE' && path === '/logs') {
      const body = JSON.parse(event.body ?? '{}');
      if (typeof body.createdAt !== 'string' || !body.createdAt.trim()) {
        return jsonResponse(400, {
          message: 'createdAt is required',
        });
      }

      const anonId = event.headers?.['x-anon-id'] || 'demo-user';

      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            anonId,
            createdAt: body.createdAt,
          },
        })
      );

      return jsonResponse(200, {
        message: 'log deleted',
        createdAt: body.createdAt,
      });
    }

    return jsonResponse(404, {
      message: 'not found',
      method,
      path,
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(500, {
      message: 'internal server error',
      error: error.message,
    });
  }
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,x-anon-id',
      'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
    },
    body: JSON.stringify(body),
  };
}

function toDateKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function validateLogInput(body) {
  if (!['charge', 'discharge'].includes(body.type)) {
    return 'type must be charge or discharge';
  }

  if (![1, 2, 3].includes(Number(body.value))) {
    return 'value must be 1, 2, or 3';
  }

  if (typeof body.title !== 'string') {
    return 'title is required';
  }

  const trimmedTitle = body.title.trim();
  if (!trimmedTitle) {
    return 'title is required';
  }

  if (trimmedTitle.length > 60) {
    return 'title must be 60 characters or fewer';
  }

  return null;
}

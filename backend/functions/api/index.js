exports.handler = async (event) => {
  // API Gateway から渡されたリクエスト内容をログに出す
  console.log('event:', JSON.stringify(event, null, 2));

  // いまは疎通確認用の固定レスポンスだけを返している
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
    },
    body: JSON.stringify({
      message: 'Energy Log API is working',
      method: event.requestContext?.http?.method ?? null,
      path: event.rawPath ?? null,
    }),
  };
};

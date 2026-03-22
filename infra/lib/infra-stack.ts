// CDK の基本機能
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

// 利用する AWS サービス定義
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

// Lambda コードの配置パスを組み立てる
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Energy Log の保存先となる DynamoDB テーブル
    const table = new dynamodb.Table(this, 'EnergyLogsTable', {
      partitionKey: { name: 'anonId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expireAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API の本体となる Lambda 関数
    const apiFunction = new lambda.Function(this, 'EnergyLogApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/api')),
      // Lambda から保存先テーブル名を参照できるようにする
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Lambda が DynamoDB を読み書きできるようにする
    table.grantReadWriteData(apiFunction);

    // 外部公開する HTTP API
    const httpApi = new apigwv2.HttpApi(this, 'EnergyLogHttpApi', {
      corsPreflight: {
        allowHeaders: ['Content-Type', 'x-anon-id'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
      },
    });

    // API Gateway から Lambda を呼び出すための接続
    const lambdaIntegration = new integrations.HttpLambdaIntegration(
      'EnergyLogLambdaIntegration',
      apiFunction
    );

    // すべてのサブパスを Lambda に流す
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.PUT,
        apigwv2.HttpMethod.DELETE,
        apigwv2.HttpMethod.OPTIONS,
      ],
      integration: lambdaIntegration,
    });

    // ルートパスも Lambda に流す
    httpApi.addRoutes({
      path: '/',
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.PUT,
        apigwv2.HttpMethod.DELETE,
        apigwv2.HttpMethod.OPTIONS,
      ],
      integration: lambdaIntegration,
    });

    // デプロイ後に API の URL を確認できるようにする
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.url ?? 'No URL',
    });
  }
}

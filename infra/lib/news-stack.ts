import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Aws, CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

const frontPageIndexName = 'front-page-index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const githubOidcProviderArn =
  'arn:aws:iam::752725527807:oidc-provider/token.actions.githubusercontent.com';

const githubPermissions = [
  'acm:*',
  'apigateway:*',
  'cloudformation:*',
  'cloudfront:*',
  'cognito-idp:*',
  'dynamodb:*',
  'events:*',
  'iam:*',
  'lambda:*',
  'logs:*',
  'route53:*',
  's3:*',
  'ssm:*',
  'sts:GetCallerIdentity',
];

export class NewsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const siteDomain = 'news.bolte.cc';
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: 'Z07962673R455HKPYUG0T',
      zoneName: 'bolte.cc',
    });

    const storiesTable = new dynamodb.Table(this, 'StoriesTable', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    storiesTable.addGlobalSecondaryIndex({
      indexName: frontPageIndexName,
      partitionKey: {
        name: 'publicationStatus',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'rankingScore',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    const commentsTable = new dynamodb.Table(this, 'CommentsTable', {
      partitionKey: {
        name: 'storyId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'commentId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const userPoolClient = userPool.addClient('UserPoolClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
    });

    const lambdaEnvironment = {
      STORIES_TABLE_NAME: storiesTable.tableName,
      COMMENTS_TABLE_NAME: commentsTable.tableName,
      USERS_TABLE_NAME: usersTable.tableName,
      FRONT_PAGE_INDEX_NAME: frontPageIndexName,
    };

    const buildFunction = (id: string, entry: string, timeoutSeconds = 10) =>
      new NodejsFunction(this, id, {
        entry: path.join(projectRoot, entry),
        runtime: Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: Duration.seconds(timeoutSeconds),
        environment: lambdaEnvironment,
        depsLockFilePath: path.join(projectRoot, 'pnpm-lock.yaml'),
        bundling: {
          target: 'node20',
        },
      });

    const listStoriesFunction = buildFunction(
      'ListStoriesFunction',
      'services/api/src/handlers/list-stories.ts',
    );
    const getStoryFunction = buildFunction(
      'GetStoryFunction',
      'services/api/src/handlers/get-story.ts',
    );
    const listCommentsFunction = buildFunction(
      'ListCommentsFunction',
      'services/api/src/handlers/list-comments.ts',
    );
    const createCommentFunction = buildFunction(
      'CreateCommentFunction',
      'services/api/src/handlers/create-comment.ts',
    );
    const getMeFunction = buildFunction('GetMeFunction', 'services/api/src/handlers/get-me.ts');
    const refreshFeedsFunction = buildFunction(
      'RefreshFeedsFunction',
      'services/api/src/handlers/refresh-feeds.ts',
      60,
    );
    const healthFunction = buildFunction('HealthFunction', 'services/api/src/handlers/health.ts');

    storiesTable.grantReadData(listStoriesFunction);
    storiesTable.grantReadData(getStoryFunction);
    storiesTable.grantReadWriteData(refreshFeedsFunction);
    storiesTable.grantReadWriteData(createCommentFunction);
    commentsTable.grantReadData(listCommentsFunction);
    commentsTable.grantReadWriteData(createCommentFunction);
    usersTable.grantReadWriteData(getMeFunction);
    usersTable.grantReadWriteData(createCommentFunction);

    const api = new HttpApi(this, 'NewsApi', {
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowOrigins: ['https://news.bolte.cc', 'http://localhost:5173'],
      },
    });

    const userAuthorizer = new HttpUserPoolAuthorizer('UserPoolAuthorizer', userPool, {
      userPoolClients: [userPoolClient],
    });

    api.addRoutes({
      path: '/api/feed',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListStoriesIntegration', listStoriesFunction),
    });
    api.addRoutes({
      path: '/api/stories/{storyId}',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetStoryIntegration', getStoryFunction),
    });
    api.addRoutes({
      path: '/api/stories/{storyId}/comments',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListCommentsIntegration', listCommentsFunction),
    });
    api.addRoutes({
      path: '/api/stories/{storyId}/comments',
      methods: [HttpMethod.POST],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration('CreateCommentIntegration', createCommentFunction),
    });
    api.addRoutes({
      path: '/api/me',
      methods: [HttpMethod.GET],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration('GetMeIntegration', getMeFunction),
    });
    api.addRoutes({
      path: '/api/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFunction),
    });

    new events.Rule(this, 'RefreshFeedsSchedule', {
      schedule: events.Schedule.rate(Duration.minutes(30)),
      targets: [new targets.LambdaFunction(refreshFeedsFunction)],
    });

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: siteDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const apiStage = api.defaultStage;
    const apiOriginPath =
      apiStage && apiStage.stageName !== '$default' ? `/${apiStage.stageName}` : '';
    const apiOrigin = new origins.HttpOrigin(
      `${api.apiId}.execute-api.${this.region}.${Aws.URL_SUFFIX}`,
      {
        originPath: apiOriginPath,
      },
    );

    const distribution = new Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      certificate,
      domainNames: [siteDomain],
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        'api/*': {
          origin: apiOrigin,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(1),
        },
      ],
    });

    new route53.ARecord(this, 'SiteAliasRecord', {
      zone: hostedZone,
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    new route53.AaaaRecord(this, 'SiteAliasRecordIpv6', {
      zone: hostedZone,
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [
        s3deploy.Source.asset(path.join(projectRoot, 'apps/web/dist')),
        s3deploy.Source.data(
          'runtime-config.json',
          JSON.stringify(
            {
              apiBaseUrl: '/api',
              region: this.region,
              userPoolId: userPool.userPoolId,
              userPoolClientId: userPoolClient.userPoolClientId,
            },
            null,
            2,
          ),
        ),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    const githubOidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidcProvider',
      githubOidcProviderArn,
    );

    const githubDeployRole = new iam.Role(this, 'GitHubDeployRole', {
      assumedBy: new iam.FederatedPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': 'repo:codekansas/news:ref:refs/heads/master',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      description: 'GitHub Actions deploy role for the news repository.',
      inlinePolicies: {
        DeployPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: githubPermissions,
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    new CfnOutput(this, 'SiteUrl', {
      value: `https://${siteDomain}`,
    });
    new CfnOutput(this, 'RefreshFunctionName', {
      value: refreshFeedsFunction.functionName,
    });
    new CfnOutput(this, 'GitHubDeployRoleArn', {
      value: githubDeployRole.roleArn,
    });
    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
  }
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Aws,
  CfnOutput,
  CustomResource,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
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
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cr from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';

const frontPageIndexName = 'front-page-index';
const pastDayIndexName = 'past-day-index';
const pushSubscriptionsEndpointIndexName = 'endpoint-index';
const searchCollectionName = 'news-search';
const searchIndexName = 'stories';

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
  'aoss:*',
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
    storiesTable.addGlobalSecondaryIndex({
      indexName: pastDayIndexName,
      partitionKey: {
        name: 'publicationDate',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'publishedAtMs',
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

    const favoritesTable = new dynamodb.Table(this, 'FavoritesTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'storyId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'notificationId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const pushSubscriptionsTable = new dynamodb.Table(this, 'PushSubscriptionsTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'endpoint',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    pushSubscriptionsTable.addGlobalSecondaryIndex({
      indexName: pushSubscriptionsEndpointIndexName,
      partitionKey: {
        name: 'endpoint',
        type: dynamodb.AttributeType.STRING,
      },
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

    const ensureVapidKeysFunction = new NodejsFunction(this, 'EnsureVapidKeysFunction', {
      entry: path.join(projectRoot, 'infra/lib/ensure-vapid-keys.ts'),
      runtime: Runtime.NODEJS_24_X,
      memorySize: 256,
      timeout: Duration.seconds(30),
      depsLockFilePath: path.join(projectRoot, 'pnpm-lock.yaml'),
      bundling: {
        target: 'node24',
      },
    });
    ensureVapidKeysFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:CreateSecret',
          'secretsmanager:DescribeSecret',
          'secretsmanager:GetSecretValue',
          'secretsmanager:PutSecretValue',
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:news/web-push-vapid*`,
        ],
      }),
    );

    const vapidKeysProvider = new cr.Provider(this, 'VapidKeysProvider', {
      onEventHandler: ensureVapidKeysFunction,
    });
    const vapidKeysResource = new CustomResource(this, 'VapidKeysResource', {
      serviceToken: vapidKeysProvider.serviceToken,
      properties: {
        secretName: 'news/web-push-vapid',
      },
    });

    const searchEncryptionPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'SearchEncryptionPolicy',
      {
        name: 'news-search-encryption',
        type: 'encryption',
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${searchCollectionName}`],
            },
          ],
          AWSOwnedKey: true,
        }),
      },
    );
    const searchNetworkPolicy = new opensearchserverless.CfnSecurityPolicy(
      this,
      'SearchNetworkPolicy',
      {
        name: 'news-search-network',
        type: 'network',
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: 'collection',
                Resource: [`collection/${searchCollectionName}`],
              },
              {
                ResourceType: 'dashboard',
                Resource: [`collection/${searchCollectionName}`],
              },
            ],
            AllowFromPublic: true,
          },
        ]),
      },
    );
    const searchCollection = new opensearchserverless.CfnCollection(this, 'SearchCollection', {
      description: 'OpenSearch Serverless collection for AI News story search.',
      name: searchCollectionName,
      type: 'SEARCH',
    });
    searchCollection.addDependency(searchEncryptionPolicy);
    searchCollection.addDependency(searchNetworkPolicy);

    const lambdaEnvironment = {
      STORIES_TABLE_NAME: storiesTable.tableName,
      COMMENTS_TABLE_NAME: commentsTable.tableName,
      FAVORITES_TABLE_NAME: favoritesTable.tableName,
      NOTIFICATIONS_TABLE_NAME: notificationsTable.tableName,
      PUSH_SUBSCRIPTIONS_TABLE_NAME: pushSubscriptionsTable.tableName,
      USERS_TABLE_NAME: usersTable.tableName,
      FRONT_PAGE_INDEX_NAME: frontPageIndexName,
      PAST_DAY_INDEX_NAME: pastDayIndexName,
      PUSH_SUBSCRIPTIONS_ENDPOINT_INDEX_NAME: pushSubscriptionsEndpointIndexName,
      SEARCH_COLLECTION_ENDPOINT: searchCollection.attrCollectionEndpoint,
      SEARCH_INDEX_NAME: searchIndexName,
      VAPID_SECRET_ARN: vapidKeysResource.getAttString('secretArn'),
    };

    const buildFunction = (id: string, entry: string, timeoutSeconds = 10) =>
      new NodejsFunction(this, id, {
        entry: path.join(projectRoot, entry),
        runtime: Runtime.NODEJS_24_X,
        memorySize: 512,
        timeout: Duration.seconds(timeoutSeconds),
        environment: lambdaEnvironment,
        depsLockFilePath: path.join(projectRoot, 'pnpm-lock.yaml'),
        bundling: {
          target: 'node24',
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
    const listRecentCommentsFunction = buildFunction(
      'ListRecentCommentsFunction',
      'services/api/src/handlers/list-recent-comments.ts',
    );
    const listUserCommentsFunction = buildFunction(
      'ListUserCommentsFunction',
      'services/api/src/handlers/list-user-comments.ts',
    );
    const listUserFavoritesFunction = buildFunction(
      'ListUserFavoritesFunction',
      'services/api/src/handlers/list-user-favorites.ts',
    );
    const getFavoriteFunction = buildFunction(
      'GetFavoriteFunction',
      'services/api/src/handlers/get-favorite.ts',
    );
    const putFavoriteFunction = buildFunction(
      'PutFavoriteFunction',
      'services/api/src/handlers/put-favorite.ts',
    );
    const deleteFavoriteFunction = buildFunction(
      'DeleteFavoriteFunction',
      'services/api/src/handlers/delete-favorite.ts',
    );
    const listNotificationsFunction = buildFunction(
      'ListNotificationsFunction',
      'services/api/src/handlers/list-notifications.ts',
    );
    const markNotificationsReadFunction = buildFunction(
      'MarkNotificationsReadFunction',
      'services/api/src/handlers/mark-notifications-read.ts',
    );
    const putPushSubscriptionFunction = buildFunction(
      'PutPushSubscriptionFunction',
      'services/api/src/handlers/put-push-subscription.ts',
    );
    const deletePushSubscriptionFunction = buildFunction(
      'DeletePushSubscriptionFunction',
      'services/api/src/handlers/delete-push-subscription.ts',
    );
    const searchStoriesFunction = buildFunction(
      'SearchStoriesFunction',
      'services/api/src/handlers/search-stories.ts',
    );
    const createCommentFunction = buildFunction(
      'CreateCommentFunction',
      'services/api/src/handlers/create-comment.ts',
    );
    const getMeFunction = buildFunction('GetMeFunction', 'services/api/src/handlers/get-me.ts');
    const updateMeFunction = buildFunction(
      'UpdateMeFunction',
      'services/api/src/handlers/update-me.ts',
    );
    const refreshFeedsFunction = buildFunction(
      'RefreshFeedsFunction',
      'services/api/src/handlers/refresh-feeds.ts',
      300,
    );
    const healthFunction = buildFunction('HealthFunction', 'services/api/src/handlers/health.ts');

    storiesTable.grantReadData(listStoriesFunction);
    storiesTable.grantReadData(getStoryFunction);
    storiesTable.grantReadData(listRecentCommentsFunction);
    storiesTable.grantReadData(listUserCommentsFunction);
    storiesTable.grantReadData(listUserFavoritesFunction);
    storiesTable.grantReadData(putFavoriteFunction);
    storiesTable.grantReadData(searchStoriesFunction);
    storiesTable.grantReadWriteData(refreshFeedsFunction);
    storiesTable.grantReadWriteData(createCommentFunction);
    commentsTable.grantReadData(listCommentsFunction);
    commentsTable.grantReadData(listRecentCommentsFunction);
    commentsTable.grantReadData(listUserCommentsFunction);
    commentsTable.grantReadWriteData(createCommentFunction);
    favoritesTable.grantReadData(listUserFavoritesFunction);
    favoritesTable.grantReadData(getFavoriteFunction);
    favoritesTable.grantReadWriteData(putFavoriteFunction);
    favoritesTable.grantReadWriteData(deleteFavoriteFunction);
    notificationsTable.grantReadData(listNotificationsFunction);
    notificationsTable.grantReadWriteData(markNotificationsReadFunction);
    notificationsTable.grantReadWriteData(createCommentFunction);
    pushSubscriptionsTable.grantReadWriteData(putPushSubscriptionFunction);
    pushSubscriptionsTable.grantReadWriteData(deletePushSubscriptionFunction);
    pushSubscriptionsTable.grantReadWriteData(createCommentFunction);
    usersTable.grantReadWriteData(getMeFunction);
    usersTable.grantReadData(listUserCommentsFunction);
    usersTable.grantReadData(listUserFavoritesFunction);
    usersTable.grantReadWriteData(updateMeFunction);
    usersTable.grantReadWriteData(createCommentFunction);
    createCommentFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [vapidKeysResource.getAttString('secretArn')],
      }),
    );

    refreshFeedsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [searchCollection.attrArn],
      }),
    );
    searchStoriesFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [searchCollection.attrArn],
      }),
    );

    const refreshFeedsRole = refreshFeedsFunction.role;
    const searchStoriesRole = searchStoriesFunction.role;
    if (!refreshFeedsRole || !searchStoriesRole) {
      throw new Error('Expected Lambda execution roles to be defined.');
    }

    new opensearchserverless.CfnAccessPolicy(this, 'SearchDataAccessPolicy', {
      name: 'news-search-access',
      type: 'data',
      policy: JSON.stringify([
        {
          Description: 'Read access for the AI News search Lambda.',
          Principal: [searchStoriesRole.roleArn],
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${searchCollectionName}`],
              Permission: ['aoss:DescribeCollectionItems'],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${searchCollectionName}/*`],
              Permission: ['aoss:DescribeIndex', 'aoss:ReadDocument'],
            },
          ],
        },
        {
          Description: 'Write access for the AI News refresh Lambda.',
          Principal: [refreshFeedsRole.roleArn],
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${searchCollectionName}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DescribeCollectionItems',
                'aoss:UpdateCollectionItems',
              ],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${searchCollectionName}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:UpdateIndex',
                'aoss:WriteDocument',
              ],
            },
          ],
        },
      ]),
    }).addDependency(searchCollection);

    const api = new HttpApi(this, 'NewsApi', {
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [
          CorsHttpMethod.DELETE,
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.OPTIONS,
        ],
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
      path: '/api/comments',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListRecentCommentsIntegration',
        listRecentCommentsFunction,
      ),
    });
    api.addRoutes({
      path: '/api/users/{username}/comments',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListUserCommentsIntegration',
        listUserCommentsFunction,
      ),
    });
    api.addRoutes({
      path: '/api/users/{username}/favorites',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        'ListUserFavoritesIntegration',
        listUserFavoritesFunction,
      ),
    });
    api.addRoutes({
      path: '/api/stories/{storyId}/favorite',
      methods: [HttpMethod.GET],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration('GetFavoriteIntegration', getFavoriteFunction),
    });
    api.addRoutes({
      path: '/api/stories/{storyId}/favorite',
      methods: [HttpMethod.PUT],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration('PutFavoriteIntegration', putFavoriteFunction),
    });
    api.addRoutes({
      path: '/api/stories/{storyId}/favorite',
      methods: [HttpMethod.DELETE],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration('DeleteFavoriteIntegration', deleteFavoriteFunction),
    });
    api.addRoutes({
      path: '/api/notifications',
      methods: [HttpMethod.GET],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration(
        'ListNotificationsIntegration',
        listNotificationsFunction,
      ),
    });
    api.addRoutes({
      path: '/api/notifications/read',
      methods: [HttpMethod.POST],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration(
        'MarkNotificationsReadIntegration',
        markNotificationsReadFunction,
      ),
    });
    api.addRoutes({
      path: '/api/notifications/push-subscription',
      methods: [HttpMethod.PUT],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration(
        'PutPushSubscriptionIntegration',
        putPushSubscriptionFunction,
      ),
    });
    api.addRoutes({
      path: '/api/notifications/push-subscription',
      methods: [HttpMethod.DELETE],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration(
        'DeletePushSubscriptionIntegration',
        deletePushSubscriptionFunction,
      ),
    });
    api.addRoutes({
      path: '/api/search',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('SearchStoriesIntegration', searchStoriesFunction),
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
      path: '/api/me',
      methods: [HttpMethod.PUT],
      authorizer: userAuthorizer,
      integration: new HttpLambdaIntegration('UpdateMeIntegration', updateMeFunction),
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
              pushPublicKey: vapidKeysResource.getAttString('publicKey'),
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
            'token.actions.githubusercontent.com:sub': [
              'repo:codekansas/news:ref:refs/heads/master',
              'repo:codekansas/news:environment:production',
            ],
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

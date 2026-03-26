import type { PushSubscriptionInput } from '@news/shared';
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { emptyResponse, parseJsonBody, textResponse } from '../lib/http';
import { savePushSubscription } from '../lib/notifications';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims.sub;
    if (typeof userId !== 'string') {
      return textResponse(401, 'Authentication is required.');
    }

    const subscription = parseJsonBody<PushSubscriptionInput>(event.body);
    await savePushSubscription(userId, subscription);
    return emptyResponse();
  } catch (error) {
    return textResponse(
      400,
      error instanceof Error ? error.message : 'Unable to save push subscription.',
    );
  }
};

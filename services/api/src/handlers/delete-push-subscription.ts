import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { emptyResponse, parseJsonBody, textResponse } from '../lib/http';
import { deletePushSubscription } from '../lib/notifications';

type DeletePushSubscriptionInput = {
  endpoint: string;
};

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims.sub;
    if (typeof userId !== 'string') {
      return textResponse(401, 'Authentication is required.');
    }

    const body = parseJsonBody<DeletePushSubscriptionInput>(event.body);
    if (!body.endpoint) {
      return textResponse(400, 'Push subscription endpoint is required.');
    }

    await deletePushSubscription(userId, body.endpoint);
    return emptyResponse();
  } catch (error) {
    return textResponse(
      400,
      error instanceof Error ? error.message : 'Unable to remove push subscription.',
    );
  }
};

import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { emptyResponse, textResponse } from '../lib/http';
import { markAllNotificationsRead } from '../lib/notifications';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims.sub;
    if (typeof userId !== 'string') {
      return textResponse(401, 'Authentication is required.');
    }

    await markAllNotificationsRead(userId);
    return emptyResponse();
  } catch (error) {
    return textResponse(
      500,
      error instanceof Error ? error.message : 'Unable to mark notifications as read.',
    );
  }
};

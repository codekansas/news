import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { jsonResponse, textResponse } from '../lib/http';
import { listNotificationsForUser } from '../lib/notifications';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const userId = event.requestContext.authorizer.jwt.claims.sub;
    if (typeof userId !== 'string') {
      return textResponse(401, 'Authentication is required.');
    }

    const notifications = await listNotificationsForUser(userId);
    return jsonResponse(200, notifications);
  } catch (error) {
    return textResponse(
      500,
      error instanceof Error ? error.message : 'Unable to load notifications.',
    );
  }
};

import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { jsonResponse, textResponse } from '../lib/http';
import { ensureUserProfile } from '../lib/users';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const claims = event.requestContext.authorizer.jwt.claims;
    const userId = claims.sub;
    const email = typeof claims.email === 'string' ? claims.email : null;

    if (typeof userId !== 'string' || !email) {
      return textResponse(401, 'Authentication is required.');
    }

    const profile = await ensureUserProfile(userId, email);
    return jsonResponse(200, { profile });
  } catch (error) {
    return textResponse(500, error instanceof Error ? error.message : 'Unable to load profile.');
  }
};

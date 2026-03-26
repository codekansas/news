import type { UpdateUserProfileInput } from '@news/shared';
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { jsonResponse, parseJsonBody, textResponse } from '../lib/http';
import { ensureUserProfile, updateUserProfile } from '../lib/users';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const body = parseJsonBody<UpdateUserProfileInput>(event.body);
    const claims = event.requestContext.authorizer.jwt.claims;
    const userId = claims.sub;
    const email = typeof claims.email === 'string' ? claims.email : null;

    if (typeof userId !== 'string' || !email) {
      return textResponse(401, 'Authentication is required.');
    }

    const currentProfile = await ensureUserProfile(userId, email);
    const profile = await updateUserProfile(currentProfile, body);
    return jsonResponse(200, { profile });
  } catch (error) {
    return textResponse(400, error instanceof Error ? error.message : 'Unable to update profile.');
  }
};

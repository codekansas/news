import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { favoriteStory } from '../lib/favorites';
import { emptyResponse, getPathParam, textResponse } from '../lib/http';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const storyId = getPathParam(event.pathParameters, 'storyId');
    const userId = event.requestContext.authorizer.jwt.claims.sub;

    if (typeof userId !== 'string') {
      return textResponse(401, 'Authentication is required.');
    }

    await favoriteStory(userId, storyId);
    return emptyResponse();
  } catch (error) {
    return textResponse(400, error instanceof Error ? error.message : 'Unable to favorite story.');
  }
};

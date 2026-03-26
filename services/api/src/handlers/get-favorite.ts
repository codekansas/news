import type { FavoriteStatusResponse } from '@news/shared';
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { isStoryFavorited } from '../lib/favorites';
import { getPathParam, jsonResponse, textResponse } from '../lib/http';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const storyId = getPathParam(event.pathParameters, 'storyId');
    const userId = event.requestContext.authorizer.jwt.claims.sub;

    if (typeof userId !== 'string') {
      return textResponse(401, 'Authentication is required.');
    }

    return jsonResponse(200, {
      isFavorite: await isStoryFavorited(userId, storyId),
    } satisfies FavoriteStatusResponse);
  } catch (error) {
    return textResponse(
      400,
      error instanceof Error ? error.message : 'Unable to load favorite status.',
    );
  }
};

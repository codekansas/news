import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { listCommentsForStory } from '../lib/comments';
import { getPathParam, jsonResponse, textResponse } from '../lib/http';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const storyId = getPathParam(event.pathParameters, 'storyId');
    const comments = await listCommentsForStory(storyId);
    return jsonResponse(200, { comments });
  } catch (error) {
    return textResponse(500, error instanceof Error ? error.message : 'Unable to load comments.');
  }
};

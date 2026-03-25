import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getPathParam, jsonResponse, textResponse } from '../lib/http';
import { getStoryById } from '../lib/stories';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const storyId = getPathParam(event.pathParameters, 'storyId');
    const story = await getStoryById(storyId);

    if (!story) {
      return textResponse(404, 'Story not found.');
    }

    return jsonResponse(200, { story });
  } catch (error) {
    return textResponse(500, error instanceof Error ? error.message : 'Unable to fetch story.');
  }
};

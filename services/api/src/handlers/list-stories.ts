import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { jsonResponse, textResponse } from '../lib/http';
import { listFrontPageStories } from '../lib/stories';

export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    const stories = await listFrontPageStories();
    return jsonResponse(200, { stories });
  } catch (error) {
    return textResponse(500, error instanceof Error ? error.message : 'Unable to list stories.');
  }
};

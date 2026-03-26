import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { jsonResponse, textResponse } from '../lib/http';
import { listStoriesPage } from '../lib/stories';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const mode = event.queryStringParameters?.mode === 'past' ? 'past' : ('front' as const);
    const day = event.queryStringParameters?.day;
    const cursor = event.queryStringParameters?.cursor;
    const limitParam = event.queryStringParameters?.limit;
    const pageSize = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listStoriesPage({
      mode,
      day,
      cursor,
      pageSize,
    });

    return jsonResponse(200, page);
  } catch (error) {
    return textResponse(400, error instanceof Error ? error.message : 'Unable to list stories.');
  }
};

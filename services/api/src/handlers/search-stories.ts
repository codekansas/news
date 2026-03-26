import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { jsonResponse, textResponse } from '../lib/http';
import { searchStoriesPage } from '../lib/search';

const parsePage = (value: string | undefined) => {
  if (!value) {
    return 1;
  }

  const page = Number.parseInt(value, 10);
  if (!Number.isFinite(page) || page < 1) {
    throw new Error('Invalid page.');
  }

  return page;
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const query = event.queryStringParameters?.q ?? '';
    const page = parsePage(event.queryStringParameters?.page);
    const results = await searchStoriesPage({ query, page });
    return jsonResponse(200, results);
  } catch (error) {
    return textResponse(400, error instanceof Error ? error.message : 'Unable to search stories.');
  }
};

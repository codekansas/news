import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getPathParam, jsonResponse, textResponse } from '../lib/http';
import { listStoriesBySubmitterPage } from '../lib/stories';

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
    const username = getPathParam(event.pathParameters, 'username');
    const page = parsePage(event.queryStringParameters?.page);
    const stories = await listStoriesBySubmitterPage({ username, page });
    return jsonResponse(200, stories);
  } catch (error) {
    return textResponse(
      400,
      error instanceof Error ? error.message : 'Unable to load user submissions.',
    );
  }
};

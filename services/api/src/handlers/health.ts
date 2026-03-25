import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { jsonResponse } from '../lib/http';

export const handler: APIGatewayProxyHandlerV2 = async () =>
  jsonResponse(200, {
    ok: true,
    now: new Date().toISOString(),
  });

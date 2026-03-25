type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonResponse = (statusCode: number, body: JsonValue) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
  body: JSON.stringify(body),
});

export const textResponse = (statusCode: number, body: string) => ({
  statusCode,
  headers: {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  },
  body,
});

export const getPathParam = (
  pathParameters: Record<string, string | undefined> | undefined,
  name: string,
) => {
  const value = pathParameters?.[name];
  if (!value) {
    throw new Error(`Missing path parameter ${name}.`);
  }
  return value;
};

export const parseJsonBody = <TBody>(body: string | undefined | null): TBody => {
  if (!body) {
    throw new Error('Request body is required.');
  }
  return JSON.parse(body) as TBody;
};

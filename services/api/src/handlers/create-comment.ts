import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { createComment } from '../lib/comments';
import { getPathParam, parseJsonBody, textResponse } from '../lib/http';
import { ensureUserProfile } from '../lib/users';

type CommentInput = {
  parentId: string | null;
  text: string;
};

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  try {
    const storyId = getPathParam(event.pathParameters, 'storyId');
    const body = parseJsonBody<CommentInput>(event.body);
    const claims = event.requestContext.authorizer.jwt.claims;
    const userId = claims.sub;
    const email = typeof claims.email === 'string' ? claims.email : null;

    if (typeof userId !== 'string' || !email) {
      return textResponse(401, 'Authentication is required.');
    }

    const profile = await ensureUserProfile(userId, email);
    await createComment({
      storyId,
      parentId: body.parentId,
      text: body.text,
      authorId: profile.userId,
      authorName: profile.username,
    });

    return textResponse(201, 'created');
  } catch (error) {
    return textResponse(400, error instanceof Error ? error.message : 'Unable to create comment.');
  }
};

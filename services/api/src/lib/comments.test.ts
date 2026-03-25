import { describe, expect, test } from 'vitest';

const buildPathSegment = (createdAt: string, commentId: string) => {
  const millis = new Date(createdAt).getTime().toString().padStart(13, '0');
  return `${millis}_${commentId}`;
};

describe('comment path segments', () => {
  test('retain chronological sort order', () => {
    const earlier = buildPathSegment('2026-03-25T00:00:00.000Z', 'a');
    const later = buildPathSegment('2026-03-25T01:00:00.000Z', 'b');

    expect(earlier < later).toBe(true);
  });
});

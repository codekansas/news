import { describe, expect, test } from 'vitest';
import { buildCommentTree, buildStoryId, pickRandomPoints } from './index';

describe('pickRandomPoints', () => {
  test('is deterministic for a given seed', () => {
    expect(pickRandomPoints('story-1')).toBe(pickRandomPoints('story-1'));
    expect(pickRandomPoints('story-1')).not.toBe(pickRandomPoints('story-2'));
  });
});

describe('buildStoryId', () => {
  test('namespaces the id by source', () => {
    expect(buildStoryId('hn', 'https://example.com/post')).toMatch(/^hn_/);
  });
});

describe('buildCommentTree', () => {
  test('nests comments under their parents by parent id', () => {
    const tree = buildCommentTree([
      {
        storyId: 'story',
        commentId: 'root',
        parentId: null,
        path: '001_root',
        depth: 0,
        authorId: 'u1',
        authorName: 'rootuser',
        text: 'root',
        createdAt: '2026-03-25T00:00:00.000Z',
      },
      {
        storyId: 'story',
        commentId: 'child',
        parentId: 'root',
        path: '001_root/002_child',
        depth: 1,
        authorId: 'u2',
        authorName: 'childuser',
        text: 'child',
        createdAt: '2026-03-25T00:01:00.000Z',
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.commentId).toBe('child');
  });
});

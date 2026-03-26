import type { CommentTreeNode } from '@news/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { formatAge, renderCommentText } from '../lib/format';
import { LoadingIndicator } from './LoadingIndicator';

const CommentNodeView = ({
  comment,
  storyId,
  onReply,
  posting,
}: {
  comment: CommentTreeNode;
  storyId: string;
  onReply: (parentId: string, text: string) => Promise<void>;
  posting: boolean;
}) => {
  const { status } = useAuth();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  const submitReply = async () => {
    if (!replyText.trim()) {
      return;
    }

    await onReply(comment.commentId, replyText);
    setReplyText('');
    setReplyOpen(false);
  };

  return (
    <>
      <tr className="athing comtr" id={comment.commentId}>
        <td>
          <table border={0}>
            <tbody>
              <tr>
                <td className="ind">
                  <span className="ind-spacer" style={{ width: `${comment.depth * 40}px` }} />
                </td>
                <td className="default">
                  <div style={{ marginTop: 2, marginBottom: -10 }}>
                    <span className="comhead">
                      <span className="hnuser">{comment.authorName}</span>{' '}
                      <span className="age" title={comment.createdAt}>
                        <Link to={`/item/${storyId}`}>{formatAge(comment.createdAt)}</Link>
                      </span>
                    </span>
                  </div>
                  <br />
                  <div className="comment">
                    <div className="commtext c00">{renderCommentText(comment.text)}</div>
                    <div className="reply">
                      <p>
                        {status === 'authenticated' ? (
                          <button
                            className="reply-link"
                            onClick={() => setReplyOpen((current) => !current)}
                            type="button"
                          >
                            reply
                          </button>
                        ) : (
                          <Link to={`/login?goto=${encodeURIComponent(`/item/${storyId}`)}`}>
                            reply
                          </Link>
                        )}
                      </p>
                    </div>
                    {replyOpen ? (
                      <div className="inline-reply">
                        <textarea
                          onChange={(event) => setReplyText(event.target.value)}
                          rows={4}
                          value={replyText}
                        />
                        <br />
                        <button disabled={posting} onClick={() => void submitReply()} type="button">
                          add reply
                        </button>
                        {posting ? (
                          <>
                            {' '}
                            <LoadingIndicator compact inline label="Updating comments..." />
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
      {comment.children.map((child) => (
        <CommentNodeView
          comment={child}
          key={child.commentId}
          onReply={onReply}
          posting={posting}
          storyId={storyId}
        />
      ))}
    </>
  );
};

export const CommentTree = ({
  comments,
  storyId,
  onReply,
  posting,
}: {
  comments: CommentTreeNode[];
  storyId: string;
  onReply: (parentId: string, text: string) => Promise<void>;
  posting: boolean;
}) => (
  <table border={0} className="comment-tree">
    <tbody>
      {comments.map((comment) => (
        <CommentNodeView
          comment={comment}
          key={comment.commentId}
          onReply={onReply}
          posting={posting}
          storyId={storyId}
        />
      ))}
    </tbody>
  </table>
);

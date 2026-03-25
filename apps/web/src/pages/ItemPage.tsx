import type { CommentTreeNode, RuntimeConfig, Story } from '@news/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CommentTree } from '../components/CommentTree';
import { Layout } from '../components/Layout';
import { getComments, getStory, postComment } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatAge, renderCommentText } from '../lib/format';

export const ItemPage = ({ config }: { config: RuntimeConfig }) => {
  const navigate = useNavigate();
  const { storyId = '' } = useParams();
  const { profile, status } = useAuth();
  const [story, setStory] = useState<Story | null>(null);
  const [comments, setComments] = useState<CommentTreeNode[]>([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [storyResponse, commentsResponse] = await Promise.all([
      getStory(config, storyId),
      getComments(config, storyId),
    ]);
    setStory(storyResponse.story);
    setComments(commentsResponse.comments);
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([getStory(config, storyId), getComments(config, storyId)])
      .then(([storyResponse, commentsResponse]) => {
        if (!cancelled) {
          setStory(storyResponse.story);
          setComments(commentsResponse.comments);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the story.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, storyId]);

  const submitComment = async (parentId: string | null, text: string) => {
    if (!text.trim()) {
      return;
    }

    setPosting(true);
    setError(null);

    try {
      await postComment(config, storyId, { parentId, text });
      setCommentText('');
      await reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add comment.');
    } finally {
      setPosting(false);
    }
  };

  if (error && !story) {
    return (
      <Layout currentPage="item">
        <div className="app-error">{error}</div>
      </Layout>
    );
  }

  if (!story) {
    return (
      <Layout currentPage="item">
        <div className="app-loading">Loading story…</div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="item">
      <table border={0} className="fatitem">
        <tbody>
          <tr className="athing submission" id={story.id}>
            <td align="right" className="title" valign="top">
              <span className="rank" />
            </td>
            <td className="votelinks" valign="top">
              <center>
                <a aria-label="upvote" href={story.url} rel="noreferrer" target="_blank">
                  <div className="votearrow" title="upvote" />
                </a>
              </center>
            </td>
            <td className="title">
              <span className="titleline">
                <a href={story.url} rel="noreferrer" target="_blank">
                  {story.title}
                </a>
                <span className="sitebit comhead">
                  {' '}
                  (
                  <a href={story.siteUrl} rel="noreferrer" target="_blank">
                    <span className="sitestr">{story.siteLabel}</span>
                  </a>
                  )
                </span>
              </span>
            </td>
          </tr>
          <tr>
            <td colSpan={2} />
            <td className="subtext">
              <span className="subline">
                <span className="score">{story.points} points</span> by{' '}
                <span className="hnuser">{story.submittedBy}</span>{' '}
                <span className="age" title={story.publishedAt}>
                  <Link to={`/item/${story.id}`}>{formatAge(story.publishedAt)}</Link>
                </span>{' '}
                | <span>{story.sourceTitle}</span> |{' '}
                <Link to={`/item/${story.id}`}>{story.commentCount} comments</Link>
              </span>
            </td>
          </tr>
          <tr>
            <td colSpan={2} />
            <td>
              <div className="toptext">
                {story.summary ? <p>{story.summary}</p> : null}
                {story.storyText ? (
                  <div className="comment story-summary">{renderCommentText(story.storyText)}</div>
                ) : null}
              </div>
            </td>
          </tr>
          <tr style={{ height: 6 }} />
          <tr>
            <td colSpan={2} />
            <td>
              {status === 'authenticated' && profile ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitComment(null, commentText);
                  }}
                >
                  <textarea
                    name="text"
                    onChange={(event) => setCommentText(event.target.value)}
                    rows={8}
                    style={{ verticalAlign: 'bottom' }}
                    value={commentText}
                    wrap="virtual"
                  />
                  <br />
                  <br />
                  <input disabled={posting} type="submit" value="add comment" />
                </form>
              ) : (
                <p className="comment-login-hint">
                  <button
                    className="reply-link"
                    onClick={() =>
                      navigate(`/login?goto=${encodeURIComponent(`/item/${story.id}`)}`)
                    }
                    type="button"
                  >
                    Log in
                  </button>{' '}
                  to comment.
                </p>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      {error ? <div className="app-error">{error}</div> : null}
      <CommentTree
        comments={comments}
        onReply={submitComment}
        posting={posting}
        storyId={story.id}
      />
      <br />
      <br />
    </Layout>
  );
};

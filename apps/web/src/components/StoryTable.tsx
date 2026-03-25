import type { StorySummary } from '@news/shared';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { formatAge } from '../lib/format';

export const StoryTable = ({ stories }: { stories: StorySummary[] }) => (
  <table border={0} cellPadding={0} cellSpacing={0}>
    <tbody>
      {stories.map((story, index) => (
        <Fragment key={story.id}>
          <tr className="athing submission" id={story.id}>
            <td align="right" className="title" valign="top">
              <span className="rank">{index + 1}.</span>
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
                <span className="score" id={`score_${story.id}`}>
                  {story.points} points
                </span>{' '}
                by <span className="hnuser">{story.submittedBy}</span>{' '}
                <span className="age" title={story.publishedAt}>
                  <Link to={`/item/${story.id}`}>{formatAge(story.publishedAt)}</Link>
                </span>{' '}
                | <span>{story.sourceTitle}</span> |{' '}
                <Link to={`/item/${story.id}`}>
                  {story.commentCount > 0 ? `${story.commentCount} comments` : 'discuss'}
                </Link>
              </span>
            </td>
          </tr>
          <tr className="spacer" style={{ height: 5 }} />
        </Fragment>
      ))}
      <tr className="morespace" style={{ height: 10 }} />
    </tbody>
  </table>
);

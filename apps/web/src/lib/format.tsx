import type { ReactNode } from 'react';

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

export const formatAge = (timestamp: string): string => {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const delta = Math.max(now - then, minuteMs);

  if (delta >= dayMs) {
    const value = Math.round(delta / dayMs);
    return `${value} day${value === 1 ? '' : 's'} ago`;
  }

  if (delta >= hourMs) {
    const value = Math.round(delta / hourMs);
    return `${value} hour${value === 1 ? '' : 's'} ago`;
  }

  const value = Math.max(1, Math.round(delta / minuteMs));
  return `${value} minute${value === 1 ? '' : 's'} ago`;
};

const linkify = (value: string): ReactNode[] => {
  const parts = value.split(/(https?:\/\/[^\s]+)/g).filter(Boolean);
  let cursor = 0;

  return parts.map((part) => {
    const key = `${cursor}-${part}`;
    cursor += part.length;

    if (/^https?:\/\//.test(part)) {
      return (
        <a href={part} key={key} rel="noreferrer" target="_blank">
          {part}
        </a>
      );
    }

    return <span key={key}>{part}</span>;
  });
};

export const renderCommentText = (text: string): ReactNode[] => {
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  let cursor = 0;

  return paragraphs.map((paragraph, index) => {
    const key = `${cursor}-${paragraph}`;
    cursor += paragraph.length;

    if (index === 0) {
      return <span key={key}>{linkify(paragraph)}</span>;
    }

    return <p key={key}>{linkify(paragraph)}</p>;
  });
};

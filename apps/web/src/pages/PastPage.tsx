import type { RuntimeConfig, StorySummary } from '@news/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { StoryTable } from '../components/StoryTable';
import { listStories } from '../lib/api';

const parsePageNumber = (search: string) => {
  const value = new URLSearchParams(search).get('page');
  const page = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseCursor = (search: string) => new URLSearchParams(search).get('cursor') ?? undefined;

const parseRequestedDay = (search: string) => new URLSearchParams(search).get('day') ?? undefined;

const formatDayLabel = (day: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));

const shiftDay = (day: string, offsetDays: number) => {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const parseDayParts = (day: string) => {
  const [year, month, dayOfMonth] = day.split('-').map((part) => Number.parseInt(part, 10));
  return { year, month, dayOfMonth };
};

const buildClampedDay = (year: number, month: number, dayOfMonth: number) => {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(dayOfMonth, lastDayOfMonth);
  return new Date(Date.UTC(year, month - 1, clampedDay)).toISOString().slice(0, 10);
};

const shiftMonth = (day: string, offsetMonths: number) => {
  const { year, month, dayOfMonth } = parseDayParts(day);
  const totalMonths = year * 12 + (month - 1) + offsetMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  return buildClampedDay(targetYear, targetMonth, dayOfMonth);
};

const shiftYear = (day: string, offsetYears: number) => {
  const { year, month, dayOfMonth } = parseDayParts(day);
  return buildClampedDay(year + offsetYears, month, dayOfMonth);
};

const buildPastLink = (day: string, extra: Record<string, string | undefined> = {}) => {
  const params = new URLSearchParams({
    day,
  });

  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/past?${params.toString()}`;
};

export const PastPage = ({ config }: { config: RuntimeConfig }) => {
  const location = useLocation();
  const page = useMemo(() => parsePageNumber(location.search), [location.search]);
  const cursor = useMemo(() => parseCursor(location.search), [location.search]);
  const requestedDay = useMemo(() => parseRequestedDay(location.search), [location.search]);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(requestedDay ?? null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setNextCursor(null);
    setSelectedDay(requestedDay ?? null);

    listStories(config, {
      cursor,
      day: requestedDay,
      mode: 'past',
    })
      .then((response) => {
        if (!cancelled) {
          setStories(response.stories);
          setSelectedDay(response.selectedDay);
          setNextCursor(response.nextCursor);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load stories.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, cursor, requestedDay]);

  const resolvedDay = selectedDay ?? requestedDay ?? new Date().toISOString().slice(0, 10);
  const title = `Stories from ${formatDayLabel(resolvedDay)}`;

  const moreLink = useMemo(() => {
    if (!nextCursor) {
      return null;
    }

    return buildPastLink(resolvedDay, {
      cursor: nextCursor,
      page: String(page + 1),
    });
  }, [nextCursor, page, resolvedDay]);

  return (
    <Layout
      currentPage="past"
      headerRight={<span className="past-header-date">{resolvedDay}</span>}
    >
      <div className="past-page-intro">
        {title} (UTC)
        <div className="past-page-nav">
          Go back a{' '}
          <span className="hnmore">
            <Link to={buildPastLink(shiftDay(resolvedDay, -1))}>day</Link>
          </span>
          ,{' '}
          <span className="hnmore">
            <Link to={buildPastLink(shiftMonth(resolvedDay, -1))}>month</Link>
          </span>
          , or{' '}
          <span className="hnmore">
            <Link to={buildPastLink(shiftYear(resolvedDay, -1))}>year</Link>
          </span>
          . Go forward a{' '}
          <span className="hnmore">
            <Link to={buildPastLink(shiftDay(resolvedDay, 1))}>day</Link>
          </span>
          .
        </div>
      </div>
      {error ? (
        <div className="app-error">{error}</div>
      ) : loading ? (
        <LoadingIndicator label="Loading stories..." />
      ) : (
        <StoryTable
          moreLink={moreLink}
          showSourceTitle={false}
          startRank={(page - 1) * 30 + 1}
          stories={stories}
        />
      )}
    </Layout>
  );
};

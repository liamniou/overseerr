import type { MovieDetails } from '@server/models/Movie';
import type { TvDetails } from '@server/models/Tv';

// TMDB release types: https://developer.themoviedb.org/reference/movie-release-dates
const RELEASE_TYPE_LIMITED = 2;
const RELEASE_TYPE_THEATRICAL = 3;
const RELEASE_TYPE_DIGITAL = 4;
const RELEASE_TYPE_PHYSICAL = 5;

// Older movies often lack digital/physical entries on TMDB; assume they're out.
const ASSUME_RELEASED_AFTER_DAYS = 120;

export interface UnreleasedInfo {
  // YYYY-MM-DD of the expected release, if known
  date?: string;
  // 'theatrical' when no digital date is announced yet but cinemas are upcoming
  dateType?: 'digital' | 'theatrical';
}

const toDay = (date: string): string => date.slice(0, 10);

const today = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
};

const daysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const earliest = (dates: string[]): string | undefined =>
  dates.length ? [...dates].sort()[0] : undefined;

/**
 * Returns release info when the movie has no digital or physical release yet
 * in any region, or undefined if it's already obtainable.
 */
export const getMovieUnreleasedInfo = (
  movie: MovieDetails
): UnreleasedInfo | undefined => {
  const now = today();
  const releases = (movie.releases?.results ?? []).flatMap(
    (r) => r.release_dates ?? []
  );

  const digital = releases
    .filter((r) => r.type === RELEASE_TYPE_DIGITAL)
    .map((r) => toDay(r.release_date));
  const physical = releases
    .filter((r) => r.type === RELEASE_TYPE_PHYSICAL)
    .map((r) => toDay(r.release_date));

  if ([...digital, ...physical].some((d) => d <= now)) {
    return undefined;
  }

  if (digital.length || physical.length) {
    return {
      date: earliest(digital) ?? earliest(physical),
      dateType: 'digital',
    };
  }

  if (
    movie.status === 'Released' &&
    movie.releaseDate &&
    toDay(movie.releaseDate) <= daysAgo(ASSUME_RELEASED_AFTER_DAYS)
  ) {
    return undefined;
  }

  const theatrical = releases
    .filter(
      (r) =>
        r.type === RELEASE_TYPE_LIMITED || r.type === RELEASE_TYPE_THEATRICAL
    )
    .map((r) => toDay(r.release_date));
  const firstTheatrical =
    earliest(theatrical) ??
    (movie.releaseDate ? toDay(movie.releaseDate) : undefined);

  return firstTheatrical && firstTheatrical >= now
    ? { date: firstTheatrical, dateType: 'theatrical' }
    : {};
};

/**
 * Returns release info when the show hasn't premiered yet, or when any of the
 * given seasons hasn't started airing. Undefined if everything has aired.
 */
export const getTvUnreleasedInfo = (
  tv: TvDetails,
  seasonNumbers: number[]
): (UnreleasedInfo & { seasons: number[] }) | undefined => {
  const now = today();

  if (!tv.firstAirDate || toDay(tv.firstAirDate) > now) {
    return {
      date: tv.firstAirDate ? toDay(tv.firstAirDate) : undefined,
      seasons: [],
    };
  }

  const unaired = (tv.seasons ?? []).filter(
    (s) =>
      seasonNumbers.includes(s.seasonNumber) &&
      (!s.airDate || toDay(s.airDate) > now)
  );

  if (!unaired.length) {
    return undefined;
  }

  return {
    date: earliest(
      unaired.filter((s) => s.airDate).map((s) => toDay(s.airDate))
    ),
    seasons: unaired.map((s) => s.seasonNumber).sort((a, b) => a - b),
  };
};

export interface CalendarEvent {
  title: string;
  date: string; // YYYY-MM-DD
  description?: string;
  url?: string;
}

const compactDate = (date: string): string => date.replace(/-/g, '');

const nextDay = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const escapeIcs = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

export const buildIcs = (event: CalendarEvent): string => {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const description = [event.description, event.url]
    .filter(Boolean)
    .join('\n\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Overseerr//Release Reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${compactDate(event.date)}-${stamp}-${Math.random()
      .toString(36)
      .slice(2)}@overseerr`,
    `DTSTAMP:${stamp}Z`,
    `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    ...(description ? [`DESCRIPTION:${escapeIcs(description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
};

export const downloadIcs = (event: CalendarEvent): void => {
  const blob = new Blob([buildIcs(event)], {
    type: 'text/calendar;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${event.title.replace(/[^\w\d-]+/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
};

export const googleCalendarUrl = (event: CalendarEvent): string => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${compactDate(event.date)}/${compactDate(nextDay(event.date))}`,
    details: [event.description, event.url].filter(Boolean).join('\n\n'),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

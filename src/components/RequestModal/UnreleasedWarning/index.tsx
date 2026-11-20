import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import type { CalendarEvent } from '@app/utils/releaseHelpers';
import { downloadIcs, googleCalendarUrl } from '@app/utils/releaseHelpers';
import { ArrowDownTrayIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  notReleasedMovie: 'This movie is not digitally released yet',
  notReleasedTv: 'This series has not premiered yet',
  notReleasedSeasons:
    '{seasonCount, plural, one {Season {seasons} has} other {Seasons {seasons} have}} not aired yet',
  expectedDigital: 'Expected digital release: <strong>{date}</strong>.',
  expectedPremiere: 'Expected premiere: <strong>{date}</strong>.',
  noDate: 'No release date has been announced yet.',
  noDigitalTheatrical:
    'No digital release date has been announced yet. Theatrical release: <strong>{date}</strong>.',
  requestAnyway:
    'You can still request it and it will be downloaded once available. Do you want to continue?',
  addToCalendar: 'Add to Calendar (.ics)',
  googleCalendar: 'Google Calendar',
  calendarTitleMovie: '{title} digital release',
  calendarTitleTheatrical: '{title} theatrical release',
  calendarTitleTv: '{title} premiere',
  calendarTitleSeasons:
    '{title} {seasonCount, plural, one {Season} other {Seasons}} {seasons} premiere',
});

interface UnreleasedWarningProps {
  mediaType: 'movie' | 'tv';
  title: string;
  tmdbId: number;
  date?: string;
  dateType?: 'digital' | 'theatrical';
  seasons?: number[];
}

const UnreleasedWarning = ({
  mediaType,
  title,
  tmdbId,
  date,
  dateType = 'digital',
  seasons = [],
}: UnreleasedWarningProps) => {
  const intl = useIntl();
  const seasonList = seasons.join(', ');

  const heading =
    mediaType === 'movie'
      ? intl.formatMessage(messages.notReleasedMovie)
      : seasons.length
      ? intl.formatMessage(messages.notReleasedSeasons, {
          seasonCount: seasons.length,
          seasons: seasonList,
        })
      : intl.formatMessage(messages.notReleasedTv);

  const event: CalendarEvent | undefined = date
    ? {
        title:
          mediaType === 'movie'
            ? intl.formatMessage(
                dateType === 'theatrical'
                  ? messages.calendarTitleTheatrical
                  : messages.calendarTitleMovie,
                { title }
              )
            : seasons.length
            ? intl.formatMessage(messages.calendarTitleSeasons, {
                title,
                seasonCount: seasons.length,
                seasons: seasonList,
              })
            : intl.formatMessage(messages.calendarTitleTv, { title }),
        date,
        url:
          typeof window !== 'undefined'
            ? `${window.location.origin}/${mediaType}/${tmdbId}`
            : undefined,
      }
    : undefined;

  return (
    <div className="mt-6">
      <Alert title={heading} type="warning">
        <p>
          {date
            ? intl.formatMessage(
                mediaType === 'tv'
                  ? messages.expectedPremiere
                  : dateType === 'theatrical'
                  ? messages.noDigitalTheatrical
                  : messages.expectedDigital,
                {
                  date: intl.formatDate(`${date}T00:00:00`, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                  strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                }
              )
            : intl.formatMessage(messages.noDate)}{' '}
          {intl.formatMessage(messages.requestAnyway)}
        </p>
        {event && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              buttonType="warning"
              buttonSize="sm"
              type="button"
              onClick={() => downloadIcs(event)}
            >
              <ArrowDownTrayIcon />
              <span>{intl.formatMessage(messages.addToCalendar)}</span>
            </Button>
            <Button
              as="a"
              buttonType="warning"
              buttonSize="sm"
              href={googleCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <CalendarIcon />
              <span>{intl.formatMessage(messages.googleCalendar)}</span>
            </Button>
          </div>
        )}
      </Alert>
    </div>
  );
};

export default UnreleasedWarning;

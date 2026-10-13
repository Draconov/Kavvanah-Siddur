import type { PrayerTime } from './core';

/** Timed calendar observances for the prayer-times screen.
 *
 * Reuse Hebcal's existing calendar results so Friday/Yom Tov candle-lighting,
 * Havdalah and fast boundaries follow the same location and halachic settings
 * as the Calendar view. In particular, never synthesize candle lighting on an
 * ordinary weekday or infer it from sunset alone.
 */
export interface TimedCalendarEvent {
  getDate(): { greg(): Date };
  render(locale: string): string;
  eventTime?: Date;
}

export interface SpecialTime {
  id: string;
  title: string;
  he: string;
  time: Date;
}

/** Calendar days are civil days; comparisons must not use UTC date slices. */
function civilKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function timedCalendarEventsForDate(events: readonly TimedCalendarEvent[], selectedDate: string): SpecialTime[] {
  return events.flatMap((event, index) => {
    const time = event.eventTime;
    if (!(time instanceof Date) || !Number.isFinite(time.getTime()) || civilKey(event.getDate().greg()) !== selectedDate) return [];
    return [{
      id: `${selectedDate}-special-${index}`,
      title: event.render('en'),
      he: event.render('he'),
      time,
    }];
  }).sort((left, right) => left.time.getTime() - right.time.getTime());
}

/** One chronological timeline for regular zmanim and timed observances.
 * Invalid or unavailable daily zmanim remain visible at the end, rather than
 * accidentally appearing before the first valid time at extreme latitudes.
 * For identical instants, retain the order of daily zmanim before observances.
 */
export type TimelineTime =
  | (PrayerTime & { kind: 'daily' })
  | (SpecialTime & { kind: 'special' });

function timestamp(value: Date | null): number {
  const ms = value?.getTime();
  return ms !== undefined && Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function chronologicalPrayerTimes(
  dailyTimes: readonly PrayerTime[],
  specialTimes: readonly SpecialTime[],
): TimelineTime[] {
  const combined: TimelineTime[] = [
    ...dailyTimes.map(time => ({ ...time, kind: 'daily' as const })),
    ...specialTimes.map(time => ({ ...time, kind: 'special' as const })),
  ];
  return combined.sort((a, b) => {
    const difference = timestamp(a.time) - timestamp(b.time);
    if (!Number.isNaN(difference) && difference !== 0) return difference;
    if (a.kind !== b.kind) return a.kind === 'daily' ? -1 : 1;
    return 0; // stable ordering within each input, including missing times
  });
}

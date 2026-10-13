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

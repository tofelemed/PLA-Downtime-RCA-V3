/** `Since 19:41` for a stop that began on `today`'s plant date, `Since 2026-10-23 19:41` otherwise (inputs are plant date-time texts `date time`). */
export function stopSinceText(startText: string, nowText: string): string {
  const [startDate, ...time] = startText.split(' ');
  const [today] = nowText.split(' ');
  if (time.length === 0) return `Since ${startText}`;
  return startDate === today ? `Since ${time.join(' ')}` : `Since ${startText}`;
}

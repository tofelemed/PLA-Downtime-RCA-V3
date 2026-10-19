import type { UnitStateCoverageView } from '@/api/v2/types/reliability';

/**
 * One line of stored state coverage for the MQTT setup: durations as the screens show them ("17 h 03 min",
 * QA M6), and where the coverage starts when the window opens before the first state mapping (QA M3).
 */
export function coverageSummaryText(view: UnitStateCoverageView, duration: (seconds: number) => string, dateTime: (iso: string) => string): string {
  const c = view.coverage;
  if (!c) return 'No state mapping in this window.';
  const start = view.coverageStartsAt ? `From ${dateTime(view.coverageStartsAt)}, when the first state mapping came into force: ` : '';
  const text = `${start}scheduled ${duration(c.scheduledSeconds)}; running ${duration(c.runningSeconds)}; stopped ${duration(c.knownStoppedSeconds)}; unknown ${duration(c.unknownSeconds)}.`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}${view.truncated ? ' Timeline display is truncated.' : ''}`;
}

import { Logger } from '@nestjs/common';
import { tzdataProblems } from '../../domain/calendar/tzdata-check';

/** Logs stale ICU time-zone data at start-up (LA-13); the process keeps running so the API stays reachable. */
export function reportTzdataProblems(): void {
  const logger = new Logger('TimeZoneData');
  for (const problem of tzdataProblems()) logger.error(problem);
}

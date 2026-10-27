const LEDGER_NOTE = 'Plan ledger. Attributed = losses explained by loss lines; Unaccounted = gap − attributed − tolerance adjustment (calculated by the server).';
const DECLARED_NOTE = 'Plan ledger of declared losses. Target and Actual are the figures OT declares; Attributed = the shortfall booked to the reasons coded on the production loss event; Unaccounted = the part of the shortfall without a reason (calculated by the server).';
const DAY_NOTE = ' Each row is one plant day.';

/** The note under the grid title for the accounting mode in force. */
export function gridNote(mode: { isDay: boolean; isDeclared: boolean }): string {
  return (mode.isDeclared ? DECLARED_NOTE : LEDGER_NOTE) + (mode.isDay ? DAY_NOTE : '');
}

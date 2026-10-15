import type { ErrorMessage } from './error-message';

/** Month close, reconciliation deadlines, day certification and restatement (EXPERT_REVIEW Area 3). */
export const CLOSE_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  CLOSE_PREREQUISITES: {
    title: 'The month cannot close yet',
    text: 'Approve every period of the month and accept or dismiss the open change proposals, then try again.',
  },
  MATERIALITY_REVIEW_REQUIRED: {
    title: 'An extra review is needed first',
    text: 'The month’s adjustments reach the materiality threshold; a reviewer confirms them before finance signs off.',
  },
  MATERIALITY_REVIEW_NOT_REQUIRED: { title: 'No extra review is needed', text: 'The month’s adjustments stay below the materiality threshold.' },
  MATERIALITY_REVIEWER: { title: 'You cannot give the materiality review', text: 'Ask a reviewer named in the month close policy.' },
  MONTH_CLOSING: {
    title: 'The month is being closed',
    text: 'Its periods cannot change while the quantities are closed. Ask plant management or finance to reopen the month first.',
  },
  MONTH_LOCKED: {
    title: 'The month is locked',
    text: 'Approved periods of a locked month change only through a change proposal; the correction is marked after close.',
  },
  INVALID_MONTH: { title: 'The month is not valid', text: 'Choose the month again.' },
  HOLD_OPEN: { title: 'The period already waits for data', text: 'Release that wait first, then start a new one.' },
  NO_OPEN_HOLD: { title: 'The period is not waiting for data', text: 'Reload to see its current state.' },
  NOT_A_RESTATEMENT: { title: 'This revision restates nothing', text: 'Only a revision opened over an approved one has a restatement.' },
  PERIOD_APPROVED: { title: 'The period is already approved', text: 'A late value reaches an approved period through a change proposal.' },
};

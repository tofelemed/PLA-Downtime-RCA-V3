import type { ErrorMessage } from './error-message';

/** RCA case refusals (v2 `/rcas`, the case workspace). */
export const RCA_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  RCA_CASE_IN_USE: {
    title: 'This case cannot be deleted',
    text: 'It is closed, linked to records, has actions or came from a recommendation. Set its status instead.',
  },
  NO_TEMPLATE: { title: 'This case has no template', text: 'Only a case opened from a template can be reset to it.' },
  CLOSE_BLOCKED: {
    title: 'This case cannot be closed yet',
    text: 'Write down the root cause and finish every action (done, or cancelled with a reason) first.',
  },
};

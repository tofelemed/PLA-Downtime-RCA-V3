import type { ErrorMessage } from './error-message';

/** RCA case refusals (v2 `/rcas`, the case workspace). */
export const RCA_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  RCA_CASE_IN_USE: {
    title: 'This investigation cannot be deleted',
    text: 'It is closed, linked to records, has actions or came from a recommendation. Move it through the workflow instead.',
  },
  NO_TEMPLATE: { title: 'This investigation has no template', text: 'Only an investigation opened from a template can be reset to it.' },
  // Workflow and action refusals carry their reasons in the server's words (fieldErrors / message): titles only.
  CLOSE_BLOCKED: { title: 'Closure cannot be requested yet' },
  INVESTIGATION_BLOCKED: { title: 'The investigation cannot be accepted yet' },
  NOTE_REQUIRED: { title: 'Say why' },
  TEAM_LOCKED: { title: 'The investigation team is fixed' },
  STATUS_VIA_TRANSITION: { title: 'The status changes through the workflow' },
  BASELINE_DECLARED: { title: 'The baseline is counted by the server' },
  ACTION_TYPE_REQUIRED: { title: 'Choose the type of action' },
  NOT_PUBLISHED: { title: 'Publish the lesson first' },
};

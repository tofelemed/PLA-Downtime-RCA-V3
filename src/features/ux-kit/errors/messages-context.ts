import type { ErrorMessage } from './error-message';

/**
 * Codes worded for one kind of screen, passed as `context` to `describeError` / `FriendlyErrorAlert`.
 * A generic code keeps its meaning in `ERROR_MESSAGES` everywhere else.
 */

/** Plant-wide policy versions (stop and plan policy): a unit-scoped approver writing for the whole plant. */
export const PLANT_WIDE_POLICY_MESSAGES: Readonly<Record<string, ErrorMessage>> = {
  TENANT_SCOPE_REQUIRED: {
    title: 'A plant-wide policy needs an approver for the whole plant',
    text: 'Your approval covers only some units. Choose one of your units, or ask a plant-level approver to change the plant-wide setting.',
  },
};

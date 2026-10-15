/** Friendly errors (docs/UI_UX_AUDIT.md §6): plain titles and messages; codes only in a support reference. */
export { ERROR_MESSAGES, NETWORK_MESSAGE, UNKNOWN_MESSAGE, statusMessage, type ErrorMessage } from './error-messages';
export { describeError, refusalTitle, isHumanMessage, type FriendlyError, type SupportReferenceInfo } from './describe-error';
export { PLANT_WIDE_POLICY_MESSAGES } from './messages-context';
export { fieldLabel } from './field-label';
export { friendlyToastContent } from './friendly-toast';
export { supportReferenceText } from './support-reference-text';
export { SupportReference, type SupportReferenceProps } from './support-reference';
export { FieldMessageList } from './field-message-list';
export { FriendlyErrorAlert, type FriendlyErrorAlertProps } from './friendly-error-alert';

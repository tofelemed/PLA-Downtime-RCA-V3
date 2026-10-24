const FIELD_SELECTOR = 'input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button[role=combobox]:not(:disabled), button[role=radio]:not(:disabled), button[role=checkbox]:not(:disabled)';

/**
 * `onOpenAutoFocus` of a dialog or side panel whose header holds a button (an ⓘ): focus the first field of
 * the body instead of that button; without a field the default focus stays.
 */
export function focusFirstField(container: HTMLElement | null, event: Event) {
  const field = container?.querySelector<HTMLElement>(FIELD_SELECTOR);
  if (!field) return;
  event.preventDefault();
  field.focus();
}

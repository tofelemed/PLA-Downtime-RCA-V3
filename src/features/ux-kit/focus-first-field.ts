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

/** `onOpenAutoFocus={focusFirstFieldOf}`: the same, inside the dialog or panel that fired the event (no ref needed). */
export function focusFirstFieldOf(event: Event) {
  const container = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  focusFirstField(container, event);
}

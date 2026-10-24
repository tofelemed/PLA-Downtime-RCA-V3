/**
 * `onOpenAutoFocus` of a form dialog whose title has an ⓘ: the field with this id gets focus on open, not
 * the ⓘ (used by the site, custom-attribute and plant-flow dialogs).
 */
export const focusFirstField = (id: string) => (event: Event) => {
  const field = document.getElementById(id);
  if (!field) return;
  event.preventDefault();
  field.focus();
};

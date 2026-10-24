/** `onOpenAutoFocus` of a plant-flow dialog: its first field gets focus, not the ⓘ next to the title. */
export const focusFirstField = (id: string) => (event: Event) => {
  const field = document.getElementById(id);
  if (!field) return;
  event.preventDefault();
  field.focus();
};

/**
 * Opt-in h-9 controls for a form or dialog body built from the shared fields (TextField, ChoiceField,
 * NativeSelect, Input): one class on the container instead of a size prop on every shared field.
 * Text areas, checkboxes and radios keep their own size.
 */
export const COMPACT_FIELDS =
  '[&_input:not([type=checkbox]):not([type=radio])]:h-9 [&_select]:h-9 [&_button[role=combobox]]:h-9';

/** An option of a tool's select: the stored value and the words shown. */
export interface ChoiceOption {
  value: string;
  label: string;
}

/** Options whose words are the stored values. */
export const choicesOf = (values: readonly string[]): ChoiceOption[] => values.map((value) => ({ value, label: value }));

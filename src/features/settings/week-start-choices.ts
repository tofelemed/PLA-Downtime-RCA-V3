/** The seven possible first days of a plant's reporting week (DT-10; any day since 21 Oct 2026). */
export const WEEK_START_CHOICES = [
  { value: 'saturday', label: 'Saturday', hint: 'Iranian week, Saturday to Friday (weekend Thursday–Friday)' },
  { value: 'sunday', label: 'Sunday', hint: 'Sunday to Saturday' },
  { value: 'monday', label: 'Monday', hint: 'ISO 8601 week, Monday to Sunday' },
  { value: 'tuesday', label: 'Tuesday', hint: 'Tuesday to Monday' },
  { value: 'wednesday', label: 'Wednesday', hint: 'Wednesday to Tuesday' },
  { value: 'thursday', label: 'Thursday', hint: 'Thursday to Wednesday' },
  { value: 'friday', label: 'Friday', hint: 'Friday to Thursday' },
] as const;

/** Display name of a stored week start ("—" when the plant record has none yet). */
export function weekStartLabel(weekStart: string | null | undefined): string {
  return WEEK_START_CHOICES.find((choice) => choice.value === weekStart)?.label ?? '—';
}

/** Why a plant setting shows as text without Save: who may change the plant settings. */
export const READ_ONLY_REASON = 'Only a plant administrator or a manager approver of this plant can change these settings.';

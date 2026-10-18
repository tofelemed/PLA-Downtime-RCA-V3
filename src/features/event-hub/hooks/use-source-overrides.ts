import { useCallback, useMemo, useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { EventFormValues } from '../model/event-form';
import { sourceOwnershipOf, type SourceOwnership } from '../model/source-ownership';

export interface SourceOverrides extends SourceOwnership {
  /** true once the user chose "Override…" for the field group, or already changed one of its fields (restored draft) */
  isUnlocked: (fields: readonly string[]) => boolean;
  unlock: (fields: readonly string[]) => void;
}

/** `draft` absent: nothing counts as changed yet (isolated field renders). */
type FormView = { values: EventFormValues; draft?: { initial: EventFormValues } };

/**
 * E-5: source-owned fields of the edited event start locked; "Override…" unlocks a field group explicitly.
 * A restored draft that already changed a field keeps it unlocked (the change was made before).
 */
export function useSourceOverrides(event: ProductionEventView | null, form: FormView): SourceOverrides {
  const ownership = useMemo(() => sourceOwnershipOf(event), [event]);
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(new Set());
  const { values } = form;
  const initial = form.draft?.initial ?? values;
  const isUnlocked = useCallback(
    (fields: readonly string[]) =>
      fields.some((field) => unlocked.has(field) || values[field as keyof EventFormValues] !== initial[field as keyof EventFormValues]),
    [unlocked, values, initial],
  );
  const unlock = useCallback((fields: readonly string[]) => setUnlocked((current) => new Set([...current, ...fields])), []);
  return { ...ownership, isUnlocked, unlock };
}

import { useState } from 'react';
import { StaleRevisionError } from '@/api/v2/errors';
import { useCreateProductionEvent } from '@/api/v2/queries/event-commands';
import { usePatchProductionEvent } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { serverFormErrors, toCreateBody, toPatchBody, validateEventForm } from '../model/event-form';
import { sourceOwnershipOf, withoutSourceInterval } from '../model/source-ownership';
import type { EventFormState } from './use-event-form';

export type SubmitOutcome = 'saved' | 'invalid' | 'conflict' | 'failed' | 'unchanged';

export interface UseEventFormSubmitOptions {
  form: EventFormState;
  event: ProductionEventView | null;
  timezone: string;
  onSaved: (event: ProductionEventView) => void;
}

/**
 * Save of the event form without optimistic updates: create (Idempotency-Key) or PATCH with `If-Match`
 * = the draft's base revision. 422 field errors land on the inputs; 412 opens the conflict review,
 * after which `retryOn(latest)` sends the same changes with the latest revision.
 */
export function useEventFormSubmit({ form, event, timezone, onSaved }: UseEventFormSubmitOptions) {
  const create = useCreateProductionEvent();
  const patch = usePatchProductionEvent();
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const fail = (error: unknown): SubmitOutcome => {
    if (error instanceof StaleRevisionError) {
      setConflict(true);
      return 'conflict';
    }
    const mapped = serverFormErrors(error);
    form.setErrors(mapped.fields);
    setFormError(mapped.form);
    return 'failed';
  };

  const send = async (baseRevision: number | null): Promise<SubmitOutcome> => {
    const { values, initial } = form.draft;
    if (!event) return finish(await create.submit(toCreateBody(values, timezone)));
    const changes = withoutSourceInterval(toPatchBody(initial, values, timezone), sourceOwnershipOf(event));
    if (Object.keys(changes).length === 0) return 'unchanged';
    const revision = baseRevision ?? event.rowVersion;
    return finish(await patch.submit({ event: { ...event, rowVersion: revision }, changes }));
  };

  const finish = (saved: ProductionEventView): SubmitOutcome => {
    form.discard();
    onSaved(saved);
    return 'saved';
  };

  const run = async (baseRevision: number | null): Promise<SubmitOutcome> => {
    setFormError(null);
    const errors = validateEventForm(form.values, event ? 'edit' : 'create', timezone);
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return 'invalid';
    }
    try {
      return await send(baseRevision);
    } catch (error) {
      return fail(error);
    }
  };

  return {
    submit: () => run(form.draft.baseRevision),
    /** conflict resolved with "apply my changes": retry against the latest server revision */
    retryOn: (latest: ProductionEventView) => {
      setConflict(false);
      form.rebase(latest);
      return run(latest.rowVersion);
    },
    dismissConflict: () => setConflict(false),
    conflict,
    formError,
    pending: create.isPending || patch.isPending,
  };
}

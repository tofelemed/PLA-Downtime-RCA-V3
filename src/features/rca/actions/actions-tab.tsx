import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRcaActions } from '@/api/v2/queries/rca-cases';
import { DataState } from '@/features/ux-kit/data-state';
import { ActionIcon } from '@/lib/icons';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ActionForm } from './action-form';
import { ActionRow } from './action-row';
import { useCanWriteRca } from './use-can-write-rca';

/** `?recommendation=<id>` (item 5: "Create action for this recommendation") opens the form with it chosen. */
export const ACTION_FOR_RECOMMENDATION_PARAM = 'recommendation';

/** RCA03 actions of the case with their verification against a baseline. */
export function ActionsTab({ rcaId }: { rcaId: string }) {
  const canWriteRca = useCanWriteRca();
  const actions = useRcaActions(rcaId);
  const [params] = useSearchParams();
  const preset = params.get(ACTION_FOR_RECOMMENDATION_PARAM) ?? '';
  const items = actions.data ?? [];
  useEffect(() => {
    if (preset) document.getElementById('new-action')?.scrollIntoView?.({ block: 'start' });
  }, [preset]);
  return (
    <div className="space-y-3" data-testid="actions-tab">
      <DataState state={dataStateOf(actions, { isEmpty: items.length === 0 })} error={actions.error} detail="No actions yet.">
        <ul className="divide-y rounded-md border">
          {items.map((action) => (
            <ActionRow key={action.id} action={action} />
          ))}
        </ul>
      </DataState>
      {canWriteRca && (
        <details key={preset} id="new-action" open={preset ? true : undefined} className="group rounded-md border" data-testid="new-action-disclosure">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
            Add action
          </summary>
          <div className="border-t p-3">
            <ActionForm rcaId={rcaId} recommendationId={preset} />
          </div>
        </details>
      )}
    </div>
  );
}

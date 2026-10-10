import { useRcaActions } from '@/api/v2/queries/rca-cases';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ActionForm } from './action-form';
import { ActionRow } from './action-row';

/** RCA03 actions of the case with their verification against a baseline. */
export function ActionsTab({ rcaId, timezone }: { rcaId: string; timezone: string }) {
  const actions = useRcaActions(rcaId);
  const items = actions.data ?? [];
  return (
    <div className="space-y-3" data-testid="actions-tab">
      <DataState state={dataStateOf(actions, { isEmpty: items.length === 0 })} error={actions.error} detail="No actions yet.">
        <ul className="divide-y rounded border">
          {items.map((action) => (
            <ActionRow key={action.id} action={action} timezone={timezone} />
          ))}
        </ul>
      </DataState>
      <ActionForm rcaId={rcaId} />
    </div>
  );
}

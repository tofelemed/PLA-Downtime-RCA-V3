import { useAuth } from '@/contexts/AuthContext';
import { useApprovalActions } from '@/api/v2/queries/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { actorLabel } from '../model/display';
import { ChangeProposalsPanel } from './change-proposals-panel';
import { ExportPanel } from './export-panel';

export interface PeriodHistoryProps {
  view: ReconciliationView;
  timezone: string;
}

/** Revision history (approval actions, newest first), open change proposals (WF04) and the approved export. */
export function PeriodHistory({ view, timezone }: PeriodHistoryProps) {
  const { session } = useAuth();
  const actions = useApprovalActions(view.periodId);
  const userId = session?.user?.id ?? null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-1 text-sm" data-testid="revision-history">
        <h3 className="font-medium">Revision history</h3>
        <ul className="space-y-1">
          {(actions.data?.items ?? []).map((a) => (
            <li key={a.id} data-testid="history-action" data-action={a.action}>
              <PlantTime iso={a.at} tz={timezone} withDate /> · {a.action} ({a.fromLifecycle} → {a.toLifecycle}) by {actorLabel(a.actorId, userId, a.service)}
              {a.reason ? ` — ${a.reason}` : ''}
            </li>
          ))}
          {actions.data && actions.data.items.length === 0 && <li className="text-muted-foreground">No workflow actions yet.</li>}
        </ul>
      </section>
      <div className="space-y-4">
        <ChangeProposalsPanel view={view} timezone={timezone} />
        {view.revision.lifecycle === 'approved' && <ExportPanel view={view} timezone={timezone} />}
      </div>
    </div>
  );
}

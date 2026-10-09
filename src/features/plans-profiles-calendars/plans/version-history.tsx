import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { usePlanVersions } from '@/api/v2/queries/plans';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { VersionStateBadge } from '../components/version-state-badge';

/** Versions newest first with approval and supersession (PLAN04 history; budget / forecast live on profiles). */
export function VersionHistory({ planId, timezone }: { planId: string; timezone: string }) {
  const versions = usePlanVersions(planId);
  const items = flattenPages(versions.data?.pages);
  const numberOf = new Map(items.map((v) => [v.id, v.version]));
  return (
    <section className="space-y-2" data-testid="version-history">
      <h3 className="font-medium">Version history</h3>
      <DataState state={dataStateOf(versions, { isEmpty: items.length === 0 })} error={versions.error}>
        <ul className="space-y-1 text-sm">
          {items.map((version) => (
            <li key={version.id} className="flex flex-wrap items-center gap-2" data-testid="history-row" data-version={version.version} data-state={version.approvalState}>
              <span className="font-medium">v{version.version}</span>
              <VersionStateBadge state={version.approvalState} />
              <span>
                {version.basis}
                {version.headerTarget ? ` · header ${version.headerTarget}` : ''} · {version.distribution}
              </span>
              {version.approvedAt && (
                <span className="text-xs text-muted-foreground">
                  approved <PlantTime iso={version.approvedAt} tz={timezone} withDate />
                </span>
              )}
              {version.supersedesVersionId && <span className="text-xs text-muted-foreground">supersedes v{numberOf.get(version.supersedesVersionId) ?? '?'}</span>}
              {version.changeReason && <span className="text-xs italic">“{version.changeReason}”</span>}
            </li>
          ))}
        </ul>
      </DataState>
    </section>
  );
}

import { useApproveStatusMapping } from '@/api/v2/queries/status-mappings';
import type { SourceStatusMappingView } from '@/api/v2/types/status-mappings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { ConsoleRefusal } from '../components/console-refusal';

const STATE_LABELS: Readonly<Record<string, string>> = { draft: 'Draft — waiting for the source owner', approved: 'Approved', retired: 'Retired' };

function Approve({ version }: { version: SourceStatusMappingView }) {
  const { canApproveStatusMappings } = useCapabilities();
  const userId = useCurrentUserId();
  const approve = useApproveStatusMapping();
  if (version.state !== 'draft' || !canApproveStatusMappings) return null;
  if (version.createdBy === userId) return <p className="text-xs text-muted-foreground">You drafted this version; another source owner approves it.</p>;
  return (
    <div className="space-y-1">
      <Button size="sm" onClick={() => void approve.submit({ id: version.id }).catch(() => undefined)} disabled={approve.isPending} data-testid="mapping-approve">
        Approve version {version.version}
      </Button>
      <ConsoleRefusal error={approve.error} />
    </div>
  );
}

/** One mapping version: its status rules, when it applies, who drafted and approved it, and whether it is in force. */
export function MappingVersionCard({ version, timezone }: { version: SourceStatusMappingView; timezone: string }) {
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="mapping-version" data-state={version.state} data-in-force={version.inForce}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Version {version.version}</span>
        <Badge variant={version.state === 'draft' ? 'outline' : 'secondary'}>{STATE_LABELS[version.state] ?? version.state}</Badge>
        {version.inForce && <Badge data-testid="mapping-in-force">In force</Badge>}
      </p>
      <p className="text-muted-foreground">
        From <PlantTime iso={version.effectiveFrom} tz={timezone} withDate />
        {version.effectiveTo ? (
          <>
            {' '}
            until <PlantTime iso={version.effectiveTo} tz={timezone} withDate />
          </>
        ) : (
          ' (open-ended)'
        )}
      </p>
      <ul className="grid gap-x-4 sm:grid-cols-2" data-testid="mapping-rules">
        {version.statuses.map((s) => (
          <li key={s.status}>
            <code>{s.status}</code> → {s.released ? 'released' : 'not released'}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Drafted by {version.createdByName ?? (version.createdBy ? 'a user' : 'the system')}
        {version.approvedAt && (
          <>
            {' '}
            · approved by {version.approvedByName ?? (version.approvedBy ? 'a user' : 'the system')} on <PlantTime iso={version.approvedAt} tz={timezone} withDate />
          </>
        )}
      </p>
      {version.notes && <p className="text-xs">{version.notes}</p>}
      <Approve version={version} />
    </div>
  );
}

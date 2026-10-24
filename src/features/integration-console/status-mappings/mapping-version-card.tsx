import { useApproveStatusMapping } from '@/api/v2/queries/status-mappings';
import type { SourceStatusMappingView } from '@/api/v2/types/status-mappings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { resolvedActorText } from '@/features/ux-kit/labels/actor-labels';
import { policyNoteText } from '@/features/ux-kit/format/built-in-default';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { ConsoleRefusal } from '../components/console-refusal';
import { EffectiveFromText, PlantInstant } from '../components/plant-instant';

const STATE_LABELS: Readonly<Record<string, string>> = { draft: 'Draft — waiting for the source owner', approved: 'Approved', retired: 'Retired' };

function Approve({ version }: { version: SourceStatusMappingView }) {
  const { canApproveStatusMappings, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const approve = useApproveStatusMapping();
  if (version.state !== 'draft' || !canApproveStatusMappings) return null;
  if (!isSuperAdmin && version.createdBy === userId) return <p className="text-xs text-muted-foreground">You drafted this version; another source owner approves it.</p>;
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
    <div id={`status-mapping-${version.id}`} className="scroll-mt-24 space-y-2 rounded-md border p-3 text-sm" data-testid="mapping-version" data-state={version.state} data-in-force={version.inForce}>
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Version {version.version}</span>
        <Badge variant={version.state === 'draft' ? 'outline' : 'secondary'} className="whitespace-nowrap">{STATE_LABELS[version.state] ?? version.state}</Badge>
        {version.inForce && <Badge className="whitespace-nowrap" data-testid="mapping-in-force">In force</Badge>}
      </p>
      <p className="text-muted-foreground">
        <EffectiveFromText iso={version.effectiveFrom} tz={timezone} prefix="From" />
        {version.effectiveTo ? (
          <>
            {' '}
            until <PlantInstant iso={version.effectiveTo} tz={timezone} />
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
        Drafted by {resolvedActorText(version.createdBy, version.createdByName)}
        {version.approvedAt && (
          <>
            {' '}
            · approved by {resolvedActorText(version.approvedBy, version.approvedByName)} on <PlantInstant iso={version.approvedAt} tz={timezone} />{' '}
            <SelfDecisionBadge selfDecided={version.selfDecided} />
          </>
        )}
      </p>
      {version.notes && <p className="text-xs">{policyNoteText(version.notes)}</p>}
      <Approve version={version} />
    </div>
  );
}

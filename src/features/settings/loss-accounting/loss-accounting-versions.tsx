import { useLossAccountingVersions } from '@/api/v2/queries/loss-accounting';
import type { LossAccountingVersionView } from '@/api/v2/types/loss-accounting';
import { Badge } from '@/components/ui/badge';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { actorText, useUserNames } from '@/features/ux-kit/labels';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { selfDecisionKindOf } from '@/features/ux-kit/self-decision-kind';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { EffectiveFromText, PlantInstant } from '@/features/integration-console/components/plant-instant';
import { LossAccountingVersionActions } from './loss-accounting-version-actions';
import { useLossAccountingSummary } from './use-loss-accounting-summary';

const STATE_LABELS: Readonly<Record<string, string>> = { proposed: 'Proposed', approved: 'Approved', rejected: 'Rejected' };

function Decision({ version, timezone }: { version: LossAccountingVersionView; timezone: string }) {
  const users = useUserNames();
  const decidedBy = version.approvedBy ?? version.rejectedBy;
  return (
    <p className="text-xs text-muted-foreground">
      Drafted by {actorText({ id: version.createdBy }, users.nameOf)} on <PlantInstant iso={version.createdAt} tz={timezone} />
      {decidedBy && ` · ${version.state === 'rejected' ? 'rejected' : 'approved'} by ${users.nameOf(decidedBy)}`}
      {version.rejectionReason && `: ${version.rejectionReason}`}{' '}
      <SelfDecisionBadge selfDecided={version.selfDecided} kind={selfDecisionKindOf(version.state)} />
    </p>
  );
}

function VersionRow({ version, timezone, summaryOf }: { version: LossAccountingVersionView; timezone: string; summaryOf: (policy: LossAccountingVersionView['policy']) => string }) {
  return (
    <article className="space-y-1.5 rounded-md border p-3 text-sm" data-testid="loss-version" data-state={version.state} data-in-force={version.inForce}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Version {version.version}</h3>
        <Badge variant={version.inForce ? 'default' : 'outline'} className="whitespace-nowrap">
          {version.inForce ? 'In force' : (STATE_LABELS[version.state] ?? version.state)}
        </Badge>
        {version.state === 'approved' && (
          <span className="text-xs text-muted-foreground">
            <EffectiveFromText iso={version.effectiveFrom} tz={timezone} prefix="From" />
          </span>
        )}
      </header>
      <p>{summaryOf(version.policy)}</p>
      <Decision version={version} timezone={timezone} />
      {version.requestedEffectiveFrom && (
        <p className="text-xs">
          Commissioning backdate to <PlantInstant iso={version.requestedEffectiveFrom} tz={timezone} />
          {version.backdateReason && `: ${version.backdateReason}`}
        </p>
      )}
      <LossAccountingVersionActions version={version} />
    </article>
  );
}

/** The plant's loss accounting versions, newest first: drafts are marked Proposed and carry Approve / Reject for approvers. */
export function LossAccountingVersions() {
  const versions = useLossAccountingVersions();
  const { timezone } = usePlantTimezone();
  const summaryOf = useLossAccountingSummary();
  const items = versions.data?.items ?? [];
  return (
    <DataState state={dataStateOf(versions)} error={versions.error} onRetry={() => void versions.refetch()}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="loss-versions-empty">No version yet; the plant default applies.</p>
      ) : (
        <div className="space-y-2" data-testid="loss-versions">
          {items.map((version) => (
            <VersionRow key={version.id} version={version} timezone={timezone} summaryOf={summaryOf} />
          ))}
        </div>
      )}
    </DataState>
  );
}

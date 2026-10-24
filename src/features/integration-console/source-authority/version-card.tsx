import type { SourceAuthorityPolicyView, SourceAuthorityVersionView } from '@/api/v2/types/source-authority';
import { Badge } from '@/components/ui/badge';
import { actorText, useUserNames } from '@/features/ux-kit/labels';
import { policyNoteText } from '@/features/ux-kit/format/built-in-default';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { selfDecisionKindOf } from '@/features/ux-kit/self-decision-kind';
import { ACTUALS_SOURCE_LABELS } from '@/features/plan-dashboard/model/actuals-labels';
import { EffectiveFromText, PlantInstant } from '../components/plant-instant';
import { VersionActions } from './version-actions';

const STATE_LABELS: Readonly<Record<string, string>> = {
  proposed: 'Waiting for production accounting',
  approved: 'Approved',
  rejected: 'Rejected',
};

const sourceLabel = (source: string): string => ACTUALS_SOURCE_LABELS[source] ?? source;

/** The ranked sources of a version, or its primary / fallback when it has no hierarchy. */
export function PolicySources({ policy }: { policy: SourceAuthorityPolicyView }) {
  const entries = policy.measurementHierarchy?.entries ?? [];
  if (entries.length === 0) {
    return (
      <p data-testid="authority-sources">
        Primary {sourceLabel(policy.primarySource)}
        {policy.fallback && (
          <>
            , fallback {sourceLabel(policy.fallback.source)}
          </>
        )}
      </p>
    );
  }
  return (
    <ol className="list-decimal space-y-0.5 pl-5" data-testid="authority-sources">
      {[...entries]
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => (
          <li key={entry.rank}>
            {sourceLabel(entry.source)}
            {entry.signalSourceKey && <> · {entry.signalSourceKey}</>}
            {entry.sourceClass && <span className="text-muted-foreground"> ({entry.sourceClass.replace(/_/g, ' ')})</span>}
          </li>
        ))}
    </ol>
  );
}

/** Who drafted the version and who decided it, with the rejection reason. */
function Decision({ version, timezone }: { version: SourceAuthorityVersionView; timezone: string }) {
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

/** One source authority version: scope, state, interval, ranked sources, who drafted and decided it. */
export function VersionCard({ version, timezone }: { version: SourceAuthorityVersionView; timezone: string }) {
  return (
    <article id={`source-authority-version-${version.id}`} className="scroll-mt-24 space-y-2 rounded-md border p-3 text-sm" data-testid="authority-version" data-state={version.state} data-in-force={version.inForce}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Version {version.version}</h3>
        <Badge variant="secondary" className="whitespace-nowrap" data-testid="authority-scope-badge">
          {version.unitId ? 'This unit' : 'Whole plant'}
        </Badge>
        <Badge variant={version.inForce ? 'default' : 'outline'} className="whitespace-nowrap">{version.inForce ? 'In force' : (STATE_LABELS[version.state] ?? version.state)}</Badge>
        {version.state === 'approved' && (
          <span className="text-xs text-muted-foreground">
            <EffectiveFromText iso={version.effectiveFrom} tz={timezone} prefix="From" />
            {version.effectiveTo && (
              <>
                {' '}
                until <PlantInstant iso={version.effectiveTo} tz={timezone} />
              </>
            )}
          </span>
        )}
      </header>
      <PolicySources policy={version.policy} />
      <Decision version={version} timezone={timezone} />
      {version.requestedEffectiveFrom && (
        <p className="text-xs" data-testid="authority-backdate">
          Commissioning backdate to <PlantInstant iso={version.requestedEffectiveFrom} tz={timezone} />
          {version.backdateReason && `: ${version.backdateReason}`}
        </p>
      )}
      {version.notes && <p className="text-xs">{policyNoteText(version.notes)}</p>}
      <VersionActions version={version} />
    </article>
  );
}

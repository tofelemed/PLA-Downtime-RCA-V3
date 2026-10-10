import { PlantTime } from '@/features/ux-kit/plant-time';
import { summarizeEvidence } from '../model/evidence-summary';
import { ApprovedImpact } from './approved-impact';

export interface EvidenceViewProps {
  evidence: Record<string, unknown> | null;
  timezone: string;
}

/** RCA02 evidence package: revisions, cause codes, trend window, recurrence and approved impact. */
export function EvidenceView({ evidence, timezone }: EvidenceViewProps) {
  if (!evidence) return <p className="text-sm text-muted-foreground">No evidence package.</p>;
  const summary = summarizeEvidence(evidence);
  return (
    <dl className="grid grid-cols-[9rem_1fr] gap-x-2 gap-y-1 text-sm" data-testid="evidence-package">
      {summary.revisions !== null && (
        <>
          <dt className="text-muted-foreground">Event revisions</dt>
          <dd>{summary.revisions}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Cause</dt>
      <dd>{[summary.reason, summary.failureMode].filter(Boolean).join(' · ') || 'Not coded'}</dd>
      {summary.trendWindow && (
        <>
          <dt className="text-muted-foreground">Trend window</dt>
          <dd>
            <PlantTime iso={summary.trendWindow.from} tz={timezone} withDate /> – <PlantTime iso={summary.trendWindow.to} tz={timezone} withDate />{' '}
            ({summary.trendWindow.signals} signal(s))
          </dd>
        </>
      )}
      {summary.recurrence && (
        <>
          <dt className="text-muted-foreground">Recurrence ({summary.recurrence.windowDays} d)</dt>
          <dd data-testid="evidence-recurrence">
            same asset {summary.recurrence.sameAsset ?? '—'} · same reason {summary.recurrence.sameReason ?? '—'}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Approved impact</dt>
      <dd>{summary.approvedImpact ? <ApprovedImpact impact={summary.approvedImpact} /> : '—'}</dd>
    </dl>
  );
}

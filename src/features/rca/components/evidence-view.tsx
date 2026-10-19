import { summarizeEvidence } from '../model/evidence-summary';
import { ApprovedImpact } from './approved-impact';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useFailureModeLabel } from '../use-failure-mode-label';
import { useRcaFormat } from '../use-rca-format';
import { plural } from '@/features/ux-kit/format/plural';

export interface EvidenceViewProps {
  evidence: Record<string, unknown> | null;
  /** kept for the callers; times use the plant formatter of every RCA screen (QA L7) */
  timezone?: string;
}

/**
 * RCA02 evidence package: revisions, cause codes, trend window, recurrence and approved impact. The package
 * was frozen when the link was made (QA M3: its value view is labelled "at link time").
 */
export function EvidenceView({ evidence }: EvidenceViewProps) {
  const { number } = useNumberFormat();
  const { dateTime } = useRcaFormat();
  const modeLabel = useFailureModeLabel(Boolean(evidence));
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
      <dd>{[summary.reason, modeLabel(summary.failureMode)].filter(Boolean).join(' · ') || 'Not coded'}</dd>
      {summary.trendWindow && (
        <>
          <dt className="text-muted-foreground">Trend window</dt>
          <dd>
            {dateTime(summary.trendWindow.from)} – {dateTime(summary.trendWindow.to)}{' '}
            ({plural(summary.trendWindow.signals, 'signal', 'signals')})
          </dd>
        </>
      )}
      {summary.recurrence && (
        <>
          <dt className="text-muted-foreground">Recurrence ({number(summary.recurrence.windowDays)} d)</dt>
          <dd data-testid="evidence-recurrence">
            same asset {summary.recurrence.sameAsset ?? '—'} · same reason {summary.recurrence.sameReason ?? '—'}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Approved impact</dt>
      <dd>{summary.approvedImpact ? <ApprovedImpact impact={summary.approvedImpact} viewNote="at link time" /> : '—'}</dd>
    </dl>
  );
}

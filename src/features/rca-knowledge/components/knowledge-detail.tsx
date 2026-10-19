import { Link } from 'react-router-dom';
import { useRcaKnowledgeEntry } from '@/api/v2/queries/rca-knowledge';
import type { RcaKnowledgeView } from '@/api/v2/types/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { useRcaFormat } from '@/features/rca/use-rca-format';
import { useFailureModeLabel } from '@/features/rca/use-failure-mode-label';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PageHeader, Section } from '@/features/ux-kit/page-layout';
import { useKnowledgePermissions } from '../use-knowledge-permissions';
import { RCA_LESSON_STATUS_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { GLOSSARY } from '@/features/ux-kit/labels/glossary';
import { PublishControl, ShareControl, VoteButtons } from './knowledge-actions';
import { QualityBadge, QualityBreakdown } from './quality-score';

function Facts({ entry }: { entry: RcaKnowledgeView }) {
  const { date } = useRcaFormat();
  const modeLabel = useFailureModeLabel(Boolean(entry.failureMode));
  const { actionsSummary: actions } = entry;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <QualityBadge score={entry.qualityScore} />
      <Badge variant={entry.isPublished ? 'default' : 'outline'}>{entry.isPublished ? 'Published' : 'Unpublished'}</Badge>
      {entry.lessonStatus && (
        <Badge variant={entry.lessonStatus === 'caution' ? 'destructive' : 'secondary'} data-testid="knowledge-lesson-status">
          {RCA_LESSON_STATUS_LABELS[entry.lessonStatus] ?? entry.lessonStatus}
        </Badge>
      )}
      {entry.shareScope === 'organization' && <Badge variant="outline">Shared with other plants</Badge>}
      {entry.failureMode && <span>Failure mode: {modeLabel(entry.failureMode)}</span>}
      <span>Unit: {entry.unitName ?? (entry.unitId ? 'Unknown unit' : GLOSSARY.wholePlant)}</span>
      {entry.assetName && <span>Asset: {entry.assetName}</span>}
      <span>Written {date(entry.createdAt)}</span>
      <span>
        Actions: {actions.done} done of {actions.actions - actions.cancelled}
        {actions.cancelled > 0 ? ` (${actions.cancelled} cancelled)` : ''}
      </span>
    </span>
  );
}

function EntryBody({ entry }: { entry: RcaKnowledgeView }) {
  const { canPublish, canShare, canVote } = useKnowledgePermissions();
  const actions =
    canPublish || canShare ? (
      <div className="flex flex-wrap items-start gap-2">
        {canPublish && <PublishControl entry={entry} />}
        {canShare && <ShareControl entry={entry} />}
      </div>
    ) : undefined;
  return (
    <div className="space-y-6" data-testid="knowledge-detail">
      <PageHeader
        title={entry.title}
        back={{ to: '/rca-knowledge-base', label: 'Knowledge base' }}
        meta={<Facts entry={entry} />}
        actions={actions}
      />
      <div className="space-y-6">
        {entry.rcaId && (
          <p className="text-sm">
            Source investigation:{' '}
            <Link className="underline" to={`/rca/${entry.rcaId}`}>
              {entry.caseTitle ?? 'Open investigation'}
            </Link>
            {entry.caseStatus ? ` (${entry.caseStatus})` : ''}
          </p>
        )}
        <Section title="Problem">
          <p className="whitespace-pre-wrap text-sm">{entry.problemStatement ?? entry.description ?? 'Not written down.'}</p>
        </Section>
        <Section title="Root cause">
          <p className="whitespace-pre-wrap text-sm">{entry.rootCause ?? 'Not written down.'}</p>
        </Section>
        <Section title="Recommendations">
          {entry.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {entry.recommendations.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Quality" description="How the server scored this entry." collapsible defaultOpen={false}>
          <QualityBreakdown parts={entry.quality} />
        </Section>
        {canVote && (
          <Section title="Was this helpful?">
            <VoteButtons entry={entry} />
          </Section>
        )}
      </div>
    </div>
  );
}

/** One knowledge entry as the server describes it (case, names, actions, votes, quality). */
export function KnowledgeDetail({ id }: { id: string }) {
  const entry = useRcaKnowledgeEntry(id);
  return (
    <DataState state={dataStateOf(entry)} error={entry.error} onRetry={() => entry.refetch()}>
      {entry.data && <EntryBody entry={entry.data} />}
    </DataState>
  );
}

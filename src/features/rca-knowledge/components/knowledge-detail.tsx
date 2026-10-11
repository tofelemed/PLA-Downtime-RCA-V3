import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRcaKnowledgeEntry } from '@/api/v2/queries/rca-knowledge';
import type { RcaKnowledgeView } from '@/api/v2/types/rca-knowledge';
import { Badge } from '@/components/ui/badge';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useKnowledgePermissions } from '../use-knowledge-permissions';
import { PublishControl, VoteButtons } from './knowledge-actions';
import { QualityBadge, QualityBreakdown } from './quality-score';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Facts({ entry, timezone }: { entry: RcaKnowledgeView; timezone: string }) {
  const { actionsSummary: actions } = entry;
  return (
    <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
      <span>Unit: {entry.unitName ?? (entry.unitId ? 'Unknown unit' : 'Tenant-wide')}</span>
      {entry.assetName && <span>Asset: {entry.assetName}</span>}
      <span>
        Created <PlantTime iso={entry.createdAt} tz={timezone} withDate />
      </span>
      <span>
        Actions: {actions.done} done of {actions.actions - actions.cancelled}
        {actions.cancelled > 0 ? ` (${actions.cancelled} cancelled)` : ''}
      </span>
    </p>
  );
}

function EntryBody({ entry, timezone }: { entry: RcaKnowledgeView; timezone: string }) {
  const { canPublish, canVote } = useKnowledgePermissions();
  return (
    <article className="space-y-4 rounded border p-4" aria-label={entry.title} data-testid="knowledge-detail">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{entry.title}</h2>
          <div className="flex flex-wrap gap-1">
            <QualityBadge score={entry.qualityScore} />
            <Badge variant={entry.isPublished ? 'default' : 'outline'}>{entry.isPublished ? 'Published' : 'Unpublished'}</Badge>
          </div>
        </div>
        {canPublish && <PublishControl entry={entry} />}
      </header>
      <Facts entry={entry} timezone={timezone} />
      {entry.rcaId && (
        <p className="text-sm">
          Case:{' '}
          <Link className="underline" to={`/rca?case=${entry.rcaId}`}>
            {entry.caseTitle ?? 'Open case'}
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
            {entry.recommendations.map((title) => <li key={title}>{title}</li>)}
          </ul>
        )}
      </Section>
      <Section title="Quality">
        <QualityBreakdown parts={entry.quality} />
      </Section>
      {canVote && <VoteButtons entry={entry} />}
    </article>
  );
}

/** One knowledge entry as the server describes it (case, names, actions, votes, quality). */
export function KnowledgeDetail({ id, timezone }: { id: string; timezone: string }) {
  const entry = useRcaKnowledgeEntry(id);
  return (
    <DataState state={dataStateOf(entry)} error={entry.error} onRetry={() => entry.refetch()}>
      {entry.data && <EntryBody entry={entry.data} timezone={timezone} />}
    </DataState>
  );
}

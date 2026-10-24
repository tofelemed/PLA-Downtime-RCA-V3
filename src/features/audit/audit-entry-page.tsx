import { useParams } from 'react-router-dom';
import { useAuditEntry } from '@/api/v2/queries/administration-audit';
import type { AuditEntryView } from '@/api/v2/types/administration';
import { PageGate } from '@/features/admin/shared/page-gate';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { resolvedActorText } from '@/features/ux-kit/labels/actor-labels';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { actionLabel, entityLabel } from './components/audit-columns';

const BACK = { to: '/audit', label: pageNameOf('/audit') };

/** `/audit/:entryId`: one audit entry with its full details (was the "Audit Entry Details" dialog). */
export function AuditEntryPage() {
  const { canViewAuditLogs } = useCapabilities();
  const { entryId } = useParams();
  const entry = useAuditEntry(entryId);
  return (
    <PageGate title="Audit entry" allowed={canViewAuditLogs} deniedText="You don't have permission to read the audit log.">
      {entry.data ? (
        <EntryDetail entry={entry.data} />
      ) : (
        <Page>
          <PageHeader title="Audit entry" back={BACK} />
          <DataState state={dataStateOf(entry)} error={entry.error} onRetry={() => void entry.refetch()} back={BACK} />
        </Page>
      )}
    </PageGate>
  );
}

function EntryDetail({ entry }: { entry: AuditEntryView }) {
  const dates = usePlantDates();
  const facts: Array<[string, string]> = [
    ['Time', dates.dateTime(entry.timestamp)],
    ['User', resolvedActorText(entry.actorId, entry.actorName)],
    ['Action', actionLabel(entry.action)],
    ['Record type', entityLabel(entry.entityType)],
    ['Summary', entry.message ?? '—'],
  ];
  return (
    <Page>
      <PageHeader title={`${actionLabel(entry.action)} · ${entityLabel(entry.entityType)}`} back={BACK} />
      <Section title="Entry">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-muted-foreground">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section
        title="Technical details"
        titleAside={<KpiInfo label="Technical details" text="As recorded, including the record reference, for support and investigations." />}
        collapsible
        defaultOpen={false}
      >
        <dl className="mb-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Record reference</dt>
          <dd className="break-all font-mono text-xs">{entry.entityId}</dd>
        </dl>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{entry.details ?? '—'}</pre>
      </Section>
    </Page>
  );
}

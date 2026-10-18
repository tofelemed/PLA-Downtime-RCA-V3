import { useSearchParams } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useUserNames } from '@/features/ux-kit/labels';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { Label } from '@/components/ui/label';
import { EventHubFrame } from '../event-hub-frame';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useEventHubEnv } from '../use-event-hub-env';
import { useCurrentRcaPolicy, useRcaPolicyVersions, type RcaPolicyVersion } from './rca-policy-api';
import { RcaPolicyForm } from './rca-policy-form';
import { overrideText, ruleFacts, triggerText } from './rca-policy-text';

const AUTO_LABELS: Readonly<Record<RcaPolicyVersion['autoCreate'], string>> = {
  recommend: 'Recommend an RCA',
  create: 'Open an investigation',
};

/**
 * `/events/rca-triggers`: when an event calls for a root cause analysis (the v2 `rca_policy`, D13 / SME D17) —
 * the version in force per plant or unit, its history, and a new version for manager approvers. Rule-
 * based extra triggers are "RCA trigger hint" rules in Codes & rules.
 */
export function RcaPolicyPage() {
  return (
    <EventHubFrame>
      <RcaPolicyScreen />
    </EventHubFrame>
  );
}

function RcaPolicyScreen() {
  const env = useEventHubEnv();
  const { canManageRcaPolicies } = useCapabilities();
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unit');
  const current = useCurrentRcaPolicy(unitId);
  return (
    <Page>
      <PageHeader
        title="RCA trigger settings"
        back={{ to: '/events', label: 'Event Hub' }}
        description="When a stop or failure calls for a root cause analysis. Extra rule-based triggers are “RCA trigger hint” rules in Codes & rules."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="rca-policy-scope">Applies to</Label>
        <select
          id="rca-policy-scope"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={unitId ?? ''}
          onChange={(e) => setParams(e.target.value ? { unit: e.target.value } : {}, { replace: true })}
        >
          <option value="">Whole plant</option>
          {env.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </div>
      <Section title="In force now">
        <DataState state={dataStateOf(current)} error={current.error} onRetry={() => current.refetch()}>
          {current.data && <CurrentPolicy policy={current.data} unitScoped={Boolean(unitId)} />}
        </DataState>
      </Section>
      <Section title="New version" description="Takes effect immediately for new and running events; earlier recommendations stay as they were.">
        {!canManageRcaPolicies && <ReadOnlyHint />}
        {canManageRcaPolicies && current.data && <RcaPolicyForm key={`${unitId ?? 'plant'}:${current.data.id}`} current={current.data} unitId={unitId} />}
      </Section>
      <Section title="Version history" collapsible defaultOpen={false}>
        <VersionHistory unitId={unitId} />
      </Section>
    </Page>
  );
}

function CurrentPolicy({ policy, unitScoped }: { policy: RcaPolicyVersion; unitScoped: boolean }) {
  const { dateTime, duration, digits } = usePlantFormat();
  const inherited = unitScoped && policy.unitId === null;
  return (
    <dl className="grid grid-cols-[12rem_1fr] gap-x-4 gap-y-1 text-sm" data-testid="rca-policy-current">
      <dt className="text-muted-foreground">Version</dt>
      <dd>{policy.version}{inherited ? ' (plant-wide; this unit has no own version)' : ''}</dd>
      <dt className="text-muted-foreground">Triggers (any of)</dt>
      <dd>{triggerText(policy, duration, digits)}</dd>
      <dt className="text-muted-foreground">Critical assets and safety</dt>
      <dd>{overrideText(policy, digits)}</dd>
      {ruleFacts(policy, digits).map((fact) => (
        <RuleFact key={fact.label} label={fact.label} value={fact.value} />
      ))}
      <dt className="text-muted-foreground">When a trigger fires</dt>
      <dd>{AUTO_LABELS[policy.autoCreate]}</dd>
      <dt className="text-muted-foreground">In force since</dt>
      <dd>{dateTime(policy.effectiveFrom)}</dd>
    </dl>
  );
}

/** A workflow rule of the version: read-only here (case workflow, SME CA2–CA7). */
function RuleFact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function VersionHistory({ unitId }: { unitId: string | null }) {
  const versions = useRcaPolicyVersions(unitId);
  const users = useUserNames();
  const { dateTime, duration, digits } = usePlantFormat();
  const columns: DataTableColumn<RcaPolicyVersion>[] = [
    { id: 'version', header: 'Version', align: 'right', cell: (row) => String(row.version) }, // an identifier: stays Latin
    { id: 'triggers', header: 'Triggers', cell: (row) => triggerText(row, duration, digits) },
    { id: 'auto', header: 'When it fires', cell: (row) => AUTO_LABELS[row.autoCreate] },
    { id: 'from', header: 'From', nowrap: true, cell: (row) => dateTime(row.effectiveFrom) },
    { id: 'to', header: 'Until', nowrap: true, cell: (row) => (row.effectiveTo ? dateTime(row.effectiveTo) : 'In force') },
    { id: 'by', header: 'Set by', cell: (row) => (row.approvedBy ? users.nameOf(row.approvedBy) : 'Default') },
    { id: 'notes', header: 'Why', cell: (row) => (row.approvedBy ? row.notes ?? '—' : 'Built-in default') },
  ];
  return (
    <DataTable caption="RCA trigger policy versions" columns={columns} rows={versions.rows} getRowKey={(row) => row.id} pager={versions.pager} status={versions.status} />
  );
}

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSourceAuthorityInForce } from '@/api/v2/queries/source-authority';
import { useUnitStateCoverage } from '@/api/v2/queries/reliability-unit-state';
import { DAY_MS, rollingWindow } from '@/api/v2/queries/time-window';
import { flattenPages, useV2InfiniteList } from '@/api/v2/queries/use-v2-list';
import type { SignalView } from '@/api/v2/types/integration-mappings';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { UnitSelect } from '@/features/master-data/components/unit-select';
import { DerivedStopPreview } from '@/features/master-data/reliability/policy/derived-stop-preview';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DateRangeInput, type InstantRange } from '@/features/ux-kit/date-inputs';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { formatPlantTime } from '@/features/ux-kit/format/plant-time';
import { labelOf, SIGNAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { ACTUALS_SOURCE_LABELS } from '@/features/plan-dashboard/model/actuals-labels';
import { coverageSummaryText } from './model/coverage-text';
import { MqttSamplePreview } from './mqtt-sample-preview';
import { plural } from '@/features/ux-kit/format/plural';

function UnitReadiness({ unitId, connectionId, timezone }: { unitId: string; connectionId: string; timezone: string }) {
  const numbers = useNumberFormat();
  const authority = useSourceAuthorityInForce(unitId);
  const [range, setRange] = useState<InstantRange>(() => rollingWindow(DAY_MS));
  const coverage = useUnitStateCoverage(range.from && range.to ? { unitId, from: range.from, to: range.to } : null);
  const signals = useV2InfiniteList<SignalView>({ resource: 'signals', path: '/signals', query: { unitId, connectionId, limit: 200 }, key: { scope: { unitIds: [unitId] }, filters: { connectionId, setup: true } } });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = signals;
  useEffect(() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const now = Date.now();
  const current = flattenPages(signals.data?.pages).filter((row) => Date.parse(row.effectiveFrom) <= now && (!row.effectiveTo || Date.parse(row.effectiveTo) > now));
  return <div className="space-y-5 text-sm">
    <DataState state={dataStateOf(signals)} error={signals.error} onRetry={() => void signals.refetch()}>
      <p>{hasNextPage ? 'Loading remaining signal definitions…' : `${plural(current.length, 'current signal', 'current signals', numbers.number)} on this connection and unit.`}</p>
      {!hasNextPage && <ul className="list-disc space-y-1 pl-5">{current.map((row) => <li key={row.id}>{row.name}: {labelOf(SIGNAL_TYPE_LABELS, row.semanticType)}, source key <code className="break-all">{row.sourceKey}</code></li>)}</ul>}
    </DataState>
    <DataState state={dataStateOf(authority)} error={authority.error} onRetry={() => void authority.refetch()}>
      {authority.data && <div className="space-y-1 rounded border p-3">
        <p>Approved primary output source: <strong>{ACTUALS_SOURCE_LABELS[authority.data.policy.primarySource] ?? authority.data.policy.primarySource}</strong> (version {authority.data.version}).</p>
        <p>MQTT output is counted only when the approved priority permits it and the selected signal has usable samples. Defining a signal or checking “authority” on it does not approve MQTT as the output source.</p>
        <Link className="underline" to={`/connectivity/source-authority?unitId=${unitId}`}>Review and approve Source Priority</Link>
      </div>}
    </DataState>
    <div className="space-y-3 rounded border p-3">
      <h3 className="font-medium">Stored state coverage</h3>
      <DateRangeInput label="Coverage period" timeZone={timezone} value={range} onChange={setRange} />
      <DataState state={dataStateOf(coverage)} error={coverage.error} onRetry={() => void coverage.refetch()}>
        {coverage.data && <p>{coverageSummaryText(coverage.data, (seconds) => formatDuration(seconds, 'long', numbers.digits), (iso) => formatPlantTime(iso, timezone, true))}</p>}
      </DataState>
      <Link className="underline" to={`/master-data/unit-state?unitId=${unitId}`}>Configure Unit State rules and heartbeat</Link>
    </div>
    <DerivedStopPreview key={unitId} unitId={unitId} timezone={timezone} />
    <nav aria-label="Remaining extruder setup" className="flex flex-wrap gap-3">
      <Link className="underline" to={`/master-data/stop-policy?unitId=${unitId}`}>Stop-engine settings</Link>
      <Link className="underline" to="/planning?tab=profiles">Profiles and approved rates</Link>
      <Link className="underline" to="/planning?tab=calendars">Published calendars</Link>
      <Link className="underline" to="/planning?tab=plans">Plans and period accounting</Link>
      <Link className="underline" to="/finance">Valuation and FX</Link>
    </nav>
    <p className="text-muted-foreground">Use Signals → Preview quantity to inspect actual stored output samples, quality and coverage. In the plan period, recalculate and review the ledgers, coding gate and valuation before submitting or approving.</p>
  </div>;
}
export function MqttSetupPanel({ connectionId, timezone }: { connectionId: string; timezone: string }) {
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const setUnitId = (id: string) => setParams((current) => { const next = new URLSearchParams(current); if (id) next.set('unitId', id); else next.delete('unitId'); return next; });
  const { canWriteIntegration } = useCapabilities();
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Broker connectivity, sample decoding, state coverage and accounting readiness are separate checks. No configuration is approved automatically here.</p>
    {canWriteIntegration && <MqttSamplePreview connectionId={connectionId} timezone={timezone} />}
    <UnitSelect id="mqtt-setup-unit" label="Production unit" value={unitId} onChange={setUnitId} />
    {unitId && <UnitReadiness key={unitId} unitId={unitId} connectionId={connectionId} timezone={timezone} />}
  </div>;
}

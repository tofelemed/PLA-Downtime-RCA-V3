import { useSearchParams } from 'react-router-dom';
import { useUnitStateMappingsPage } from '@/api/v2/queries/reliability-unit-state';
import type { UnitStateMappingView } from '@/api/v2/types/reliability';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Section } from '@/features/ux-kit/page-layout';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { MasterDataLayout } from '../../components/master-data-layout';
import { UnitSelect } from '../../components/unit-select';
import { useReliabilityFormat, type ReliabilityFormat } from '../shared/use-reliability-format';
import { CoveragePanel } from './coverage-panel';
import { MappingEditor } from './mapping-editor';
import { mappingSaveResult } from './mapping-save-result';
import { MappingVersionsTable } from './mapping-versions-table';

function UnitStateSections({ unitId, canWrite, format }: { unitId: string; canWrite: boolean; format: ReliabilityFormat }) {
  const versions = useUnitStateMappingsPage(unitId);
  const current = versions.rows.find((m) => m.effectiveTo === null);
  const feedback = useSaveFeedback();
  const capabilities = useCapabilities();
  const resultOf = (saved: UnitStateMappingView) => mappingSaveResult({ saved, dateTime: format.dateTime, now: Date.now(), capabilities });
  return (
    <>
      <Section title="Mapping versions">
        <MappingVersionsTable page={versions} format={format} />
      </Section>
      {canWrite && (
        <Section title="New version" description="Physical state only: schedule status comes from the calendar, causes from events.">
          <MappingEditor key={current?.id ?? 'first'} unitId={unitId} current={current} timezone={format.timezone} feedback={feedback} resultOf={resultOf} />
        </Section>
      )}
      <Section title="Coverage">
        <CoveragePanel unitId={unitId} format={format} />
      </Section>
      {feedback.dialog}
    </>
  );
}

/**
 * `/master-data/unit-state` (SME D1 / D2): per unit, the versioned mapping of its state signal to physical
 * states with staleness settings, and the coverage of the state data with availability bounds.
 */
export function UnitStatePage() {
  const { canWriteStateMappings } = useCapabilities();
  const format = useReliabilityFormat();
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const choose = (next: string) => setParams(next ? { unitId: next } : {}, { replace: true });
  return (
    <MasterDataLayout title="Unit state" alsoAllowed={canWriteStateMappings} description="How a unit's state signal becomes running, stopped or unknown time.">
      <div className="max-w-sm"><UnitSelect id="unit-state-unit" label="Unit" value={unitId} onChange={choose} /></div>
      {unitId ? (
        <UnitStateSections unitId={unitId} canWrite={canWriteStateMappings} format={format} />
      ) : (
        <p className="text-sm text-muted-foreground">Choose a unit to see its state mapping and coverage.</p>
      )}
    </MasterDataLayout>
  );
}

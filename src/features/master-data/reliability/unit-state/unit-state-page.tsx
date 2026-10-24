import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUnitStateMappingsPage } from '@/api/v2/queries/reliability-unit-state';
import type { UnitStateMappingView } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { RcaCard } from '@/features/rca/components/rca-card';
import { OwnEmptyMessage } from '@/features/ux-kit/data-table/data-table-states';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { ActionIcon } from '@/lib/icons';
import { MasterDataLayout } from '../../components/master-data-layout';
import { UnitSelect } from '../../components/unit-select';
import { EditorSheet } from '@/features/ux-kit/editor-sheet';
import { useReliabilityFormat, type ReliabilityFormat } from '../shared/use-reliability-format';
import { CoveragePanel } from './coverage-panel';
import { MappingEditor } from './mapping-editor';
import { mappingSaveResult } from './mapping-save-result';
import { MappingVersionsTable } from './mapping-versions-table';

const MAPPING_INFO = "How the unit's state signal becomes running, stopped or unknown time; each version keeps its own rules and staleness.";
const NEW_VERSION_TEXT = 'Physical state only: schedule status comes from the calendar, causes from events. The version in force ends when the new one starts.';

function UnitStateSections({ unitId, canWrite, format }: { unitId: string; canWrite: boolean; format: ReliabilityFormat }) {
  const versions = useUnitStateMappingsPage(unitId);
  const current = versions.rows.find((m) => m.effectiveTo === null);
  const feedback = useSaveFeedback();
  const capabilities = useCapabilities();
  const [editing, setEditing] = useState(false);
  const resultOf = (saved: UnitStateMappingView) => mappingSaveResult({ saved, dateTime: format.dateTime, now: Date.now(), capabilities });
  const setOpen = (open: boolean) => {
    feedback.clearFailure();
    setEditing(open);
  };
  const action = canWrite ? (
    <Button type="button" size="sm" onClick={() => setOpen(true)}>
      <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
      New mapping version
    </Button>
  ) : null;
  return (
    <>
      <RcaCard title="Mapping versions" info={MAPPING_INFO} actions={action} testId="mapping-versions">
        <MappingVersionsTable page={versions} format={format} />
      </RcaCard>
      <CoveragePanel unitId={unitId} format={format} />
      {canWrite && (
        <EditorSheet open={editing} onOpenChange={setOpen} title="New mapping version" titleAside={<KpiInfo label="new mapping versions" text={NEW_VERSION_TEXT} />}>
          <MappingEditor
            key={current?.id ?? 'first'}
            unitId={unitId}
            current={current}
            timezone={format.timezone}
            feedback={feedback}
            resultOf={resultOf}
            onSaved={() => setEditing(false)}
            onCancel={() => setOpen(false)}
          />
        </EditorSheet>
      )}
      {feedback.dialog}
    </>
  );
}

/**
 * `/master-data/unit-state` (SME D1 / D2): per unit, the versioned mapping of its state signal to physical
 * states with staleness settings, and the coverage of the state data with availability bounds. A new mapping
 * version opens in a side panel from "New mapping version".
 */
export function UnitStatePage() {
  const { canWriteStateMappings } = useCapabilities();
  const format = useReliabilityFormat();
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const choose = (next: string) => setParams(next ? { unitId: next } : {}, { replace: true });
  return (
    <MasterDataLayout title="Unit state" alsoAllowed={canWriteStateMappings}>
      <div className="w-72">
        <UnitSelect compact id="unit-state-unit" label="Unit" value={unitId} onChange={choose} />
      </div>
      {unitId ? (
        <UnitStateSections key={unitId} unitId={unitId} canWrite={canWriteStateMappings} format={format} />
      ) : (
        <div className="rounded-lg border bg-card px-4 py-10" data-testid="unit-state-choose">
          <OwnEmptyMessage text="Choose a unit to see its state mapping and coverage." />
        </div>
      )}
    </MasterDataLayout>
  );
}

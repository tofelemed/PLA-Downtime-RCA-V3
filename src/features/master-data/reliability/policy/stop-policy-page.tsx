import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { useSearchParams } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { MasterDataLayout } from '../../components/master-data-layout';
import { COMPACT_FIELDS } from '../../components/compact-fields';
import { UnitSelect } from '../../components/unit-select';
import { useReliabilityFormat } from '../shared/use-reliability-format';
import { DerivedStopPreviewSection } from './derived-stop-preview-section';
import { MicroStopSection } from './micro-stop-section';
import { StopEngineSection } from './stop-engine-section';
import { TransitionAllowanceControl } from './transition-allowance-control';

/**
 * `/master-data/stop-policy`: the plant's or a unit's loss-accounting policy settings that are written as
 * new approved `oee_policy` versions — stop-engine settings, micro-stop thresholds and trip reasons (SME D6)
 * and the grade-change allowance (engine 2.5.6). Each section shows the version in force; manager approvers
 * record a new version from the section's "Record new version" (a side panel), others read them.
 */
export function StopPolicyPage() {
  const { canWriteOeePolicy } = useCapabilities();
  const { timezone } = usePlantTimezone();
  const format = useReliabilityFormat();
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const choose = (next: string) => setParams(next ? { unitId: next } : {}, { replace: true });
  return (
    <MasterDataLayout
      title="Stop and plan policy"
      alsoAllowed={canWriteOeePolicy}
    >
      <div className={`w-72 ${COMPACT_FIELDS}`}>
        <UnitSelect id="policy-scope" label="Applies to" value={unitId} onChange={choose} allowAll allLabel="The whole plant" />
      </div>
      {!canWriteOeePolicy && <p className="text-sm text-muted-foreground">Only manager approvers record new versions.</p>}
      <StopEngineSection key={unitId} unitId={unitId} canWrite={canWriteOeePolicy} format={format} />
      <DerivedStopPreviewSection key={`preview-${unitId}`} unitId={unitId} timezone={timezone} />
      <MicroStopSection key={`micro-${unitId}`} unitId={unitId} canWrite={canWriteOeePolicy} format={format} />
      <TransitionAllowanceControl key={`allowance-${unitId}`} unitId={unitId} canWrite={canWriteOeePolicy} format={format} />
    </MasterDataLayout>
  );
}

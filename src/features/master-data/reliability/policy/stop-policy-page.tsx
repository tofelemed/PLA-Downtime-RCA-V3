import { useSearchParams } from 'react-router-dom';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { Section } from '@/features/ux-kit/page-layout';
import { MasterDataLayout } from '../../components/master-data-layout';
import { UnitSelect } from '../../components/unit-select';
import { useReliabilityFormat } from '../shared/use-reliability-format';
import { MicroStopSection } from './micro-stop-section';
import { TransitionAllowanceControl } from './transition-allowance-control';

/**
 * `/master-data/stop-policy`: the plant's or a unit's loss-accounting policy settings that are written as
 * new approved `oee_policy` versions — micro-stop thresholds and trip reasons (SME D6) and the
 * grade-change allowance (engine 2.5.6). Manager approvers record new versions; others read them.
 */
export function StopPolicyPage() {
  const { canWriteOeePolicy } = useCapabilities();
  const format = useReliabilityFormat();
  const [params, setParams] = useSearchParams();
  const unitId = params.get('unitId') ?? '';
  const choose = (next: string) => setParams(next ? { unitId: next } : {}, { replace: true });
  return (
    <MasterDataLayout
      title="Stop and plan policy"
      alsoAllowed={canWriteOeePolicy}
      description="Settings that decide how short stops and grade changes count. Each change is a new version from now on."
    >
      <div className="max-w-sm">
        <UnitSelect id="policy-scope" label="Applies to" value={unitId} onChange={choose} allowAll allLabel="The whole plant" />
      </div>
      {!canWriteOeePolicy && <p className="text-sm text-muted-foreground">Only manager approvers record new versions.</p>}
      <Section title="Micro-stops and trips">
        <MicroStopSection unitId={unitId} canWrite={canWriteOeePolicy} format={format} />
      </Section>
      <Section title="Grade-change allowance">
        <TransitionAllowanceControl unitId={unitId} canWrite={canWriteOeePolicy} format={format} />
      </Section>
    </MasterDataLayout>
  );
}

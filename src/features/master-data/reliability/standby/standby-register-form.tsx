import { useState } from 'react';
import { useRegisterStandby } from '@/api/v2/queries/reliability-standby';
import type { StandbyEvaluation } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useToast } from '@/hooks/use-toast';
import { AssetSelect } from '../shared/asset-select';
import { SELECT_CLASS } from '../shared/use-asset-lookup';
import { EVALUATION_LABELS } from './standby-metrics-model';

const EVALUATIONS = Object.keys(EVALUATION_LABELS) as StandbyEvaluation[];

/** Register an asset as standby equipment (SME D9): how maintenance judges it and from when (default now). */
export function StandbyRegisterForm({ timezone }: { timezone: string }) {
  const [assetId, setAssetId] = useState('');
  const [evaluation, setEvaluation] = useState<StandbyEvaluation>('demand');
  const [from, setFrom] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const register = useRegisterStandby();
  const { toast } = useToast();
  const submit = async () => {
    setError(null);
    try {
      await register.submit({ assetId, evaluation, effectiveFrom: from ?? undefined });
      toast({ title: 'Standby duty registered' });
      setAssetId('');
    } catch (failure: unknown) {
      setError(failure);
    }
  };
  return (
    <form className="grid max-w-xl gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <AssetSelect id="standby-asset" label="Asset" value={assetId} onChange={setAssetId} />
      <div className="space-y-1.5">
        <Label htmlFor="standby-evaluation">Evaluated</Label>
        <select id="standby-evaluation" className={SELECT_CLASS} value={evaluation} onChange={(e) => setEvaluation(e.target.value as StandbyEvaluation)}>
          {EVALUATIONS.map((e) => <option key={e} value={e}>{EVALUATION_LABELS[e]}</option>)}
        </select>
      </div>
      <DateTimeInput label="Standby from (empty = now)" value={from} timeZone={timezone} onChange={setFrom} />
      {error !== null && <FriendlyErrorAlert error={error} title="The server refused the registration" />}
      <div><Button type="submit" disabled={!assetId || register.isPending}>Register</Button></div>
    </form>
  );
}

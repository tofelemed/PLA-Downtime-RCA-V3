import { useState } from 'react';
import { useRegisterStandby } from '@/api/v2/queries/reliability-standby';
import type { StandbyEquipmentView, StandbyEvaluation } from '@/api/v2/types/reliability';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { nextSetupLink, useSaveFeedback, type SaveResult } from '@/features/ux-kit/save-result';
import { sectionNameOf } from '../../components/master-data-sections';
import { AssetSelect } from '../shared/asset-select';
import { SELECT_CLASS, useAssetLookup } from '../shared/use-asset-lookup';
import type { ReliabilityFormat } from '../shared/use-reliability-format';
import { STANDBY_PATH } from './standby-import-model';
import { EVALUATION_LABELS } from './standby-metrics-model';

const EVALUATIONS = Object.keys(EVALUATION_LABELS) as StandbyEvaluation[];

interface StandbyDraft {
  assetId: string;
  evaluation: StandbyEvaluation;
  /** null = now */
  from: string | null;
}

const EMPTY: StandbyDraft = { assetId: '', evaluation: 'demand', from: null };

export interface StandbyRegisterFormProps {
  format: ReliabilityFormat;
  /** in the header's dialog: the registration is saved, the caller shows the result dialog (`useAddDialog().saved`) */
  onSaved?: (result: SaveResult) => void;
}

/**
 * Register an asset as standby equipment (SME D9): how maintenance judges it and from when (default now).
 * A registration ends in the result dialog (its own, or the caller's through `onSaved`).
 */
export function StandbyRegisterForm({ format, onSaved }: StandbyRegisterFormProps) {
  const [draft, setDraft] = useState<StandbyDraft>(EMPTY);
  const register = useRegisterStandby();
  const feedback = useSaveFeedback();
  const capabilities = useCapabilities();
  const { labelOf } = useAssetLookup();
  const set = (change: Partial<StandbyDraft>) => setDraft((d) => ({ ...d, ...change }));
  const resultOf = (saved: StandbyEquipmentView): SaveResult => ({
    title: 'Standby equipment registered',
    recordLabel: labelOf(saved.assetId),
    message: `${EVALUATION_LABELS[saved.evaluation]}, on standby from ${format.dateTime(saved.effectiveFrom)}.`,
    listPath: STANDBY_PATH,
    listLabel: sectionNameOf(STANDBY_PATH),
    onAddAnother: () => setDraft(EMPTY),
    next: nextSetupLink(STANDBY_PATH, { capabilities }),
  });
  const submit = async () => {
    const body = { assetId: draft.assetId, evaluation: draft.evaluation, effectiveFrom: draft.from ?? undefined };
    const saved = await feedback.run(() => register.submit(body), onSaved ? null : resultOf).catch(() => null);
    if (!saved) return;
    setDraft(EMPTY);
    onSaved?.(resultOf(saved));
  };
  return (
    <>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {feedback.alert}
        <AssetSelect id="standby-asset" label="Asset" value={draft.assetId} onChange={(assetId) => set({ assetId })} />
        <div className="space-y-1.5">
          <Label htmlFor="standby-evaluation">Evaluated</Label>
          <select id="standby-evaluation" className={SELECT_CLASS} value={draft.evaluation} onChange={(e) => set({ evaluation: e.target.value as StandbyEvaluation })}>
            {EVALUATIONS.map((e) => <option key={e} value={e}>{EVALUATION_LABELS[e]}</option>)}
          </select>
        </div>
        <DateTimeInput label="Standby from (empty = now)" value={draft.from} timeZone={format.timezone} onChange={(from) => set({ from })} />
        <div className="flex justify-end"><Button type="submit" disabled={!draft.assetId || register.isPending}>Register</Button></div>
      </form>
      {feedback.dialog}
    </>
  );
}

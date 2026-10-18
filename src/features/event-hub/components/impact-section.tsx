import type { ProductionEventView } from '@/api/v2/types/events';
import { useAssetDirectory } from '@/api/v2/queries/assets';
import { useAssetNames } from '@/features/ux-kit/labels';
import type { EventFormState } from '../hooks/use-event-form';
import type { SourceOverrides } from '../hooks/use-source-overrides';
import { assetLabel, impactBasisText } from '../model/impact-basis';
import { ownedFieldsOf } from '../model/source-ownership';
import { ImpactFields } from './impact-fields';
import { SourceOwnedField } from './source-owned-field';

export interface ImpactSectionProps {
  form: EventFormState;
  overrides: SourceOverrides;
  event: ProductionEventView | null;
}

/**
 * The impact of a stop with its stored basis in words (Marun E2E 1.5): a source-owned impact says it in the
 * "Override…" hint, otherwise under the field. The basis is the server's `impactBasis`, never the source label.
 */
export function ImpactSection({ form, overrides, event }: ImpactSectionProps) {
  const assets = useAssetNames();
  const directory = useAssetDirectory();
  const { values } = form;
  if (values.physicalType !== 'downtime') return <ImpactFields form={form} />;
  const basisText = impactBasisText({
    basis: values.impactBasis,
    sourceKind: event?.sourceKind ?? null,
    source: event?.source ?? null,
    assetName: values.assetId ? (assetLabel(directory.assets.find((a) => a.id === values.assetId)) ?? assets.nameOf(values.assetId)) : null,
  });
  if (ownedFieldsOf(overrides, ['impactMode']).length === 0) return <ImpactFields form={form} basisText={basisText} />;
  return (
    <SourceOwnedField fields={['impactMode']} overrides={overrides} origin={basisText} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <ImpactFields form={form} />
    </SourceOwnedField>
  );
}

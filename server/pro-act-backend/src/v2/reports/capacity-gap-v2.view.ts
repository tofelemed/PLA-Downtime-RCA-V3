import { RateTimebase } from '../../domain/actuals/actuals.types';
import {
  CapacityGapStep,
  CapacityRate,
  CapacityRatio,
  capacityGaps,
} from '../../domain/profiles/capacity-gap';
import { RATE_KINDS, RateKind } from '../../domain/profiles/profile.types';
import { ProductionProfile } from '../../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { decimalText } from '../profiles/profile-v2.view';

/** One kind of a row: the approved version in force, or nulls when the kind is not set. */
export interface CapacityKindView {
  /** decimal string per `timebase` in `uom`; null = not set */
  value: string | null;
  uom: string | null;
  timebase: RateTimebase | null;
  rateVersionId: string | null;
  version: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface CapacityGapRowView {
  profileId: string;
  profileVersion: number;
  unitId: string;
  unitName: string;
  productId: string;
  productName: string;
  operatingMode: string;
  /** quantity unit of every rate of the profile */
  quantityUom: string | null;
  /** every rate kind (budget and forecast are imported references: shown, never in a gap) */
  rates: Record<RateKind, CapacityKindView>;
  gaps: CapacityGapStep[];
  ratios: CapacityRatio[];
}

export interface CapacityGapReportView {
  /** instant the approved versions are in force at */
  at: string;
  items: CapacityGapRowView[];
  limit: number;
  /** more approved profiles match than `limit` rows */
  truncated: boolean;
  asOf: string;
}

const NOT_SET: CapacityKindView = {
  value: null,
  uom: null,
  timebase: null,
  rateVersionId: null,
  version: null,
  effectiveFrom: null,
  effectiveTo: null,
};

function kindView(
  rate: UnitProductRate | undefined,
  uom: string | null,
): CapacityKindView {
  if (!rate) return NOT_SET;
  return {
    value: decimalText(rate.rate),
    uom,
    timebase: rate.timebase,
    rateVersionId: rate.id,
    version: rate.version,
    effectiveFrom: rate.effectiveFrom.toISOString(),
    effectiveTo: rate.effectiveTo?.toISOString() ?? null,
  };
}

/** The row of one approved profile and its approved rates in force (newest first per kind). */
export function toCapacityGapRow(
  profile: ProductionProfile,
  rates: readonly UnitProductRate[],
): CapacityGapRowView {
  const byKind: Partial<Record<RateKind, UnitProductRate>> = {};
  for (const rate of rates) byKind[rate.rateKind] ??= rate;
  const uom = profile.quantityUom;
  const stored: Partial<Record<RateKind, CapacityRate>> = {};
  for (const [kind, rate] of Object.entries(byKind) as Array<
    [RateKind, UnitProductRate]
  >) {
    stored[kind] = { rate: rate.rate, timebase: rate.timebase, uom };
  }
  return {
    profileId: profile.id,
    profileVersion: profile.version,
    unitId: profile.unitId,
    unitName: profile.unit?.name ?? '',
    productId: profile.productId,
    productName: profile.product?.name ?? '',
    operatingMode: profile.operatingMode,
    quantityUom: uom,
    rates: Object.fromEntries(
      RATE_KINDS.map((kind) => [kind, kindView(byKind[kind], uom)]),
    ) as Record<RateKind, CapacityKindView>,
    ...capacityGaps(stored),
  };
}

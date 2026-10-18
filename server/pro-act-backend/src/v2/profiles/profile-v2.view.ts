import { formatDec, toDec } from '../../domain/actuals/decimal';
import { ImportRowError } from '../../domain/profiles/rate-import-rows';
import { formatRate, ratePerSecond } from '../../domain/profiles/rate-math';
import {
  LegacyProfileValues,
  ProductionProfile,
} from '../../profiles/entities/production-profile.entity';
import {
  RateImport,
  RateImportCounts,
} from '../../profiles/entities/rate-import.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { ValuationRate } from '../../profiles/entities/valuation-rate.entity';
import { ProfileResolution } from '../../profiles/profile-resolution.service';

export interface VersionFields {
  version: number;
  state: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** the draft's author: requires another approver unless SuperAdmin (403 SEPARATION_OF_DUTIES) */
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileV2View extends VersionFields {
  id: string;
  unitId: string;
  productId: string;
  operatingMode: string;
  quantityUom: string | null;
  rateTimebase: string | null;
  capacityModel: string;
  actualsPolicyId: string | null;
  oeePolicyId: string | null;
  valuationPolicyId: string | null;
  productMixConstraints: Record<string, unknown> | null;
  /** v1 values of a seeded profile, for review only (`standardRate` = unconfirmed legacy cost, D08) */
  legacy: LegacyProfileValues | null;
}

export interface RateV2View extends VersionFields {
  id: string;
  profileId: string;
  rateKind: string;
  rate: string;
  timebase: string;
  /** rate per second, decimal (8 places) */
  ratePerSecond: string;
  source: string;
  externalId: string | null;
  rateImportId: string | null;
}

export interface ValuationRateV2View extends VersionFields {
  id: string;
  profileId: string | null;
  impactCodeId: string | null;
  basis: string;
  value: string;
  /** null for a ratio basis (`rework_yield`: recovered per reworked quantity) */
  currency: string | null;
  perUom: string;
}

export interface RateImportV2View {
  id: string;
  kind: string;
  externalId: string;
  revision: number;
  fileRef: string | null;
  state: string;
  counts: RateImportCounts | null;
  report: ImportRowError[];
  importedBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface ProfileResolutionV2View {
  profile: ProfileV2View | null;
  /** `no_profile` when no approved profile is in force (consumers report null KPIs, T41) */
  reason: string | null;
  rates: Record<string, RateV2View>;
}

/** Canonical decimal string (no trailing zeros), whether the driver returned text or a number. */
export function decimalText(value: string | number): string {
  const parsed = toDec(value);
  return parsed ? formatDec(parsed) : String(value);
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function versionFields(row: {
  version: number;
  state: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): VersionFields {
  return {
    version: row.version,
    state: row.state,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: iso(row.effectiveTo),
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    approvedAt: iso(row.approvedAt),
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProfileView(profile: ProductionProfile): ProfileV2View {
  return {
    id: profile.id,
    unitId: profile.unitId,
    productId: profile.productId,
    operatingMode: profile.operatingMode,
    quantityUom: profile.quantityUom,
    rateTimebase: profile.rateTimebase,
    capacityModel: profile.capacityModel,
    actualsPolicyId: profile.actualsPolicyId,
    oeePolicyId: profile.oeePolicyId,
    valuationPolicyId: profile.valuationPolicyId,
    productMixConstraints: profile.productMixConstraints,
    legacy: profile.legacyValues,
    ...versionFields(profile),
  };
}

export function toRateView(rate: UnitProductRate): RateV2View {
  return {
    id: rate.id,
    profileId: rate.profileId,
    rateKind: rate.rateKind,
    rate: decimalText(rate.rate),
    timebase: rate.timebase,
    ratePerSecond: formatRate(ratePerSecond(rate)),
    source: rate.source,
    externalId: rate.externalId,
    rateImportId: rate.rateImportId,
    ...versionFields(rate),
  };
}

export function toValuationRateView(rate: ValuationRate): ValuationRateV2View {
  return {
    id: rate.id,
    profileId: rate.profileId,
    impactCodeId: rate.impactCodeId,
    basis: rate.basis,
    value: decimalText(rate.value),
    currency: rate.currency,
    perUom: rate.perUom,
    ...versionFields(rate),
  };
}

export function toRateImportView(job: RateImport): RateImportV2View {
  return {
    id: job.id,
    kind: job.kind,
    externalId: job.externalId,
    revision: job.revision,
    fileRef: job.fileRef,
    state: job.state,
    counts: job.counts,
    report: job.report ?? [],
    importedBy: job.importedBy,
    createdAt: job.createdAt.toISOString(),
    finishedAt: iso(job.finishedAt),
  };
}

export function toResolutionView(
  resolution: ProfileResolution,
): ProfileResolutionV2View {
  return {
    profile: resolution.profile ? toProfileView(resolution.profile) : null,
    reason: resolution.reason,
    rates: Object.fromEntries(
      Object.entries(resolution.rates).map(([kind, rate]) => [
        kind,
        toRateView(rate),
      ]),
    ),
  };
}

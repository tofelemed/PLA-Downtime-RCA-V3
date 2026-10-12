import type { MasterAssetView } from '../api/master-data-types';
import { requiredText, textOrNull, type FieldErrors } from '../model/field-errors';

export interface AssetDraft {
  code: string;
  name: string;
  unitId: string;
  description: string;
  assetType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  criticality: string;
  status: string;
  location: string;
}

export interface AssetBody {
  code: string;
  name: string;
  unitId: string;
  description: string | null;
  assetType: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  criticality: string | null;
  status: string | null;
  location: string | null;
}

export function assetDraftOf(asset: MasterAssetView | null, unitId = ''): AssetDraft {
  return {
    code: asset?.code ?? '',
    name: asset?.name ?? '',
    unitId: asset?.unitId ?? unitId,
    description: asset?.description ?? '',
    assetType: asset?.assetType ?? 'Equipment',
    manufacturer: asset?.manufacturer ?? '',
    model: asset?.model ?? '',
    serialNumber: asset?.serialNumber ?? '',
    criticality: asset?.criticality ?? 'Medium',
    status: asset?.status ?? 'Active',
    location: asset?.location ?? '',
  };
}

export function validateAsset(draft: AssetDraft): FieldErrors {
  return {
    name: requiredText(draft.name, 'Name'),
    code: requiredText(draft.code, 'Code'),
    unitId: draft.unitId ? undefined : 'Choose the unit the asset belongs to.',
  };
}

export function assetBodyOf(draft: AssetDraft): AssetBody {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    unitId: draft.unitId,
    description: textOrNull(draft.description),
    assetType: textOrNull(draft.assetType),
    manufacturer: textOrNull(draft.manufacturer),
    model: textOrNull(draft.model),
    serialNumber: textOrNull(draft.serialNumber),
    criticality: textOrNull(draft.criticality),
    status: textOrNull(draft.status),
    location: textOrNull(draft.location),
  };
}

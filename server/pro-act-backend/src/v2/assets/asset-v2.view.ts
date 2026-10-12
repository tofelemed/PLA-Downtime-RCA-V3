import { Asset } from '../../asset/asset.entity';

/** `GET /api/v2/assets` item and `GET /api/v2/assets/{id}` (master data of one asset of the acting plant). */
export interface AssetV2View {
  id: string;
  code: string;
  name: string;
  unitId: string;
  description: string | null;
  assetType: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  /** High | Medium | Low (v1 values) */
  criticality: string | null;
  /** operating status as maintained by the plant (Active, Inactive, Maintenance, Offline, …) */
  status: string | null;
  location: string | null;
  /** null while the asset is active */
  retiredAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function toAssetView(asset: Asset): AssetV2View {
  return {
    id: asset.id,
    code: asset.code,
    name: asset.name,
    unitId: asset.unitId,
    description: asset.description ?? null,
    assetType: asset.assetType ?? null,
    manufacturer: asset.manufacturer ?? null,
    model: asset.model ?? null,
    serialNumber: asset.serialNumber ?? null,
    criticality: asset.criticality ?? null,
    status: asset.status ?? null,
    location: asset.location ?? null,
    retiredAt: asset.retiredAt ? asset.retiredAt.toISOString() : null,
    rowVersion: asset.rowVersion,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

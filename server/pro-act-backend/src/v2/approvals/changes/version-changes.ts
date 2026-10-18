import { EntityManager } from 'typeorm';
import { ProductionProfile } from '../../../profiles/entities/production-profile.entity';
import { UnitProductRate } from '../../../profiles/entities/unit-product-rate.entity';
import { ValuationRate } from '../../../profiles/entities/valuation-rate.entity';
import { GradeTransitionStandard } from '../../../profiles/entities/transition-standard.entity';
import { UnitStream } from '../../../plant-model/entities/unit-stream.entity';
import { PlantFlowRoute } from '../../../plant-model/entities/plant-flow-route.entity';
import { UnitImpactRule } from '../../../plant-model/entities/unit-impact-rule.entity';
import { FxRate } from '../../../valuation/entities/fx-rate.entity';
import { DemandStatus } from '../../../valuation/entities/demand-status.entity';
import { ChangeRow, FieldSpec } from './change-types';
import { FamilyKind } from './family-changes';

const APPROVED = "v.state = 'approved'";
const text = (row: ChangeRow, key: string): string | null =>
  typeof row[key] === 'string' ? row[key] : null;

/** Effective window of every versioned record (half-open, plant time on the client). */
export const VALIDITY: FieldSpec[] = [
  { key: 'effectiveFrom', label: 'Effective from', format: 'instant' },
  { key: 'effectiveTo', label: 'Effective until', format: 'instant' },
];

/** `t / h` of a rate: the profile's quantity unit over the rate's time base. */
async function withProfileUom(
  manager: EntityManager,
  tenantId: string,
  rows: ChangeRow[],
): Promise<void> {
  const ids = [
    ...new Set(
      rows
        .map((row) => text(row, 'profileId'))
        .filter((id): id is string => id !== null),
    ),
  ];
  if (ids.length === 0) return;
  const profiles = await manager
    .createQueryBuilder(ProductionProfile, 'p')
    .select(['p.id', 'p.quantityUom'])
    .where('p.tenantId = :tenantId', { tenantId })
    .andWhere('p.id IN (:...ids)', { ids })
    .getMany();
  const uom = new Map(
    profiles.map((profile) => [profile.id, profile.quantityUom]),
  );
  rows.forEach((row) => {
    row.profileUom = uom.get(text(row, 'profileId') ?? '') ?? null;
  });
}

const rateUnit = (row: ChangeRow) => {
  const uom = text(row, 'profileUom');
  const timebase = text(row, 'timebase');
  return uom && timebase ? `${uom}/${timebase}` : null;
};

const version = (
  kind: Omit<FamilyKind, 'approved' | 'specs'> & { specs: FieldSpec[] },
): FamilyKind => ({
  approved: APPROVED,
  ...kind,
  specs: [...kind.specs, ...VALIDITY],
});

/** The versioned master data an approve command approves (same family keys as `approveVersion`). */
export const VERSION_CHANGE_KINDS: Readonly<Record<string, FamilyKind>> = {
  profile: version({
    entity: ProductionProfile,
    family: ['unitId', 'productId', 'operatingMode'],
    specs: [
      { key: 'productId', label: 'Product', ref: 'product' },
      { key: 'operatingMode', label: 'Operating mode' },
      { key: 'quantityUom', label: 'Quantity unit' },
      { key: 'rateTimebase', label: 'Rate time base' },
      { key: 'capacityModel', label: 'Capacity model' },
    ],
  }),
  rate: version({
    entity: UnitProductRate,
    family: ['profileId', 'rateKind'],
    decorate: withProfileUom,
    specs: [
      { key: 'rate', label: 'Rate', format: 'quantity', unit: rateUnit },
      { key: 'rateKind', label: 'Rate kind' },
      { key: 'source', label: 'Source' },
    ],
  }),
  'valuation-rate': version({
    entity: ValuationRate,
    family: ['profileId', 'impactCodeId', 'basis'],
    specs: [
      {
        key: 'value',
        label: 'Value',
        format: 'money',
        currency: (row) => text(row, 'currency'),
        unit: (row) =>
          text(row, 'perUom') ? `per ${text(row, 'perUom')}` : null,
      },
      { key: 'basis', label: 'Basis' },
      { key: 'impactCodeId', label: 'Impact code', ref: 'impact-code' },
    ],
  }),
  'transition-standard': version({
    entity: GradeTransitionStandard,
    family: [
      'unitId',
      'fromProductId',
      'toProductId',
      'catalystFamily',
      'operatingMode',
    ],
    specs: [
      {
        key: 'referenceSeconds',
        label: 'Reference duration',
        format: 'duration',
      },
      {
        key: 'referenceOffgradeQty',
        label: 'Reference off-grade',
        format: 'quantity',
        unit: (row) => text(row, 'offgradeUom'),
      },
      { key: 'fromProductId', label: 'From product', ref: 'product' },
      { key: 'toProductId', label: 'To product', ref: 'product' },
      { key: 'sampleCount', label: 'Samples', format: 'number' },
      { key: 'evidence', label: 'Evidence' },
      { key: 'notes', label: 'Notes' },
    ],
  }),
  'unit-stream': version({
    entity: UnitStream,
    family: ['unitId', 'code'],
    specs: [
      { key: 'capacityShare', label: 'Capacity share', format: 'number' },
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'notes', label: 'Notes' },
    ],
  }),
  'flow-route': version({
    entity: PlantFlowRoute,
    family: ['fromUnitId', 'toUnitId'],
    specs: [
      { key: 'yieldFactor', label: 'Yield factor', format: 'number' },
      { key: 'routeRole', label: 'Route role' },
      { key: 'fromUnitId', label: 'From unit', ref: 'unit' },
      { key: 'toUnitId', label: 'To unit', ref: 'unit' },
      { key: 'bufferName', label: 'Buffer' },
      {
        key: 'usableInventory',
        label: 'Usable inventory',
        format: 'quantity',
        unit: (row) => text(row, 'inventoryUom'),
      },
      {
        key: 'minOperatingLevel',
        label: 'Minimum operating level',
        format: 'quantity',
        unit: (row) => text(row, 'inventoryUom'),
      },
      {
        key: 'maxOperatingLevel',
        label: 'Maximum operating level',
        format: 'quantity',
        unit: (row) => text(row, 'inventoryUom'),
      },
      {
        key: 'drawRatePerHour',
        label: 'Draw rate',
        format: 'quantity',
        unit: (row) =>
          text(row, 'inventoryUom') ? `${text(row, 'inventoryUom')}/h` : null,
      },
      { key: 'notes', label: 'Notes' },
    ],
  }),
  'unit-impact-rule': version({
    entity: UnitImpactRule,
    family: ['unitId', 'assetId'],
    specs: [
      { key: 'mode', label: 'Impact mode' },
      { key: 'fraction', label: 'Fraction of the unit', format: 'number' },
      { key: 'assetId', label: 'Asset', ref: 'asset' },
      { key: 'standbyAssetId', label: 'Standby asset', ref: 'asset' },
      {
        key: 'takeoverSeconds',
        label: 'Standby takeover time',
        format: 'duration',
      },
      { key: 'reason', label: 'Reason' },
    ],
  }),
  'fx-rate': version({
    entity: FxRate,
    family: ['rateType', 'fromCurrency', 'toCurrency', 'provisional'],
    specs: [
      {
        key: 'rate',
        label: 'Rate',
        format: 'number',
        unit: (row) =>
          `${text(row, 'toCurrency') ?? ''} per ${text(row, 'fromCurrency') ?? ''}`,
      },
      { key: 'rateType', label: 'Rate type' },
      { key: 'provisional', label: 'Provisional', format: 'boolean' },
      { key: 'source', label: 'Source' },
    ],
  }),
  'demand-status': version({
    entity: DemandStatus,
    family: ['productId'],
    specs: [
      { key: 'status', label: 'Demand status' },
      { key: 'productId', label: 'Product', ref: 'product' },
      { key: 'evidence', label: 'Evidence' },
    ],
  }),
};

import { LotDisposition } from '../../quality-dispositions/entities/lot-disposition.entity';

/** A lot disposition or recovery movement as the v2 API returns it (decimals as strings). */
export interface LotDispositionV2View {
  id: string;
  unitId: string;
  productId: string;
  lotCode: string;
  dispositionClass: string;
  quantity: string;
  uom: string;
  productionStart: string;
  productionEnd: string;
  labReleasedAt: string | null;
  recoveryOfId: string | null;
  remeasured: boolean;
  productionEventId: string | null;
  supersedesId: string | null;
  reason: string | null;
  evidenceRef: string | null;
  state: string;
  authorId: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** item 1.3: decided by its own author — the stored SuperAdmin override (owner decision 2026-10-16) */
  selfDecided: boolean;
  decisionReason: string | null;
  supersededAt: string | null;
  createdAt: string;
  rowVersion: number;
}

const iso = (value: Date | null) =>
  value ? new Date(value).toISOString() : null;

export function toLotDispositionView(
  row: LotDisposition,
): LotDispositionV2View {
  return {
    id: row.id,
    unitId: row.unitId,
    productId: row.productId,
    lotCode: row.lotCode,
    dispositionClass: row.dispositionClass,
    quantity: row.quantity,
    uom: row.uom,
    productionStart: new Date(row.productionStart).toISOString(),
    productionEnd: new Date(row.productionEnd).toISOString(),
    labReleasedAt: iso(row.labReleasedAt),
    recoveryOfId: row.recoveryOfId,
    remeasured: row.remeasured,
    productionEventId: row.productionEventId,
    supersedesId: row.supersedesId,
    reason: row.reason,
    evidenceRef: row.evidenceRef,
    state: row.state,
    authorId: row.authorId,
    decidedBy: row.decidedBy,
    decidedAt: iso(row.decidedAt),
    selfDecided: row.superAdminOverride,
    decisionReason: row.decisionReason,
    supersededAt: iso(row.supersededAt),
    createdAt: new Date(row.createdAt).toISOString(),
    rowVersion: row.rowVersion,
  };
}

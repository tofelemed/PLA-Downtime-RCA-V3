import type { components } from '../schema';
import type { SourceAuthorityVersionState } from './source-authority';

/**
 * Loss accounting versions (backend `src/v2/loss-accounting/loss-accounting-v2.view.ts`, declared mode): how a
 * unit's losses are accounted (per shift or per day, computed from the plan or declared by OT). Versions are
 * maker-checker like source authority: a draft applies only once production accounting approves it.
 */
export type LossGrain = 'shift' | 'day';
export type LossBasis = 'computed' | 'declared';
export type LossTargetSource = 'plan' | 'declared';
export type LossAccountingVersionState = SourceAuthorityVersionState;

export interface LossAccountingPolicyView {
  grain: LossGrain;
  /** plant-local `HH:mm`; used when grain = day */
  dayStart: string;
  lossBasis: LossBasis;
  targetSource: LossTargetSource;
  accountingUnitId: string | null;
  /** declared mode: the product the figures are booked to when several run and no plan covers the day */
  accountingProductId: string | null;
  stopsCrossCheck: boolean;
  /** >= 0, in the event's unit of measure */
  identityTolerance: number;
}

/** `GET /loss-accounting?unitId=`: the version in force for a unit (its own, else plant-wide). */
export interface LossAccountingInForceView {
  policyId: string;
  version: number;
  unitId: string | null;
  effectiveFrom: string;
  notes: string | null;
  policy: LossAccountingPolicyView;
}

/** `GET /loss-accounting/versions` item. */
export interface LossAccountingVersionView {
  id: string;
  version: number;
  /** null = plant-wide */
  unitId: string | null;
  state: LossAccountingVersionState;
  inForce: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  basedOnId: string | null;
  createdBy: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  selfDecided: boolean;
  notes: string | null;
  requestedEffectiveFrom: string | null;
  backdateReason: string | null;
  policy: LossAccountingPolicyView;
}

/** `POST /loss-accounting/versions` (LossAccountingVersionDto): every field optional, a missing one is kept. */
export type LossAccountingDraftBody = Omit<components['schemas']['LossAccountingVersionDto'], 'accountingUnitId' | 'accountingProductId'> & {
  accountingUnitId?: string | null;
  accountingProductId?: string | null;
};

export interface LossAccountingDecisionInput {
  id: string;
  decision: 'approve' | 'reject';
  reason?: string;
}

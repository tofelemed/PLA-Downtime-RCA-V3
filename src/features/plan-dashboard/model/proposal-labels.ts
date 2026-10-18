import type { ChangeProposalView } from '@/api/v2/types/reconciliation';
import { PROPOSAL_TRIGGER_LABELS } from '@/features/month-close/model/close-labels';
import { humanize, IMPACT_MODE_LABELS, labelOf, OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The valuation input behind a `valuation_change` proposal (`detail.reason` from the server). */
const VALUATION_REASON_LABELS: Readonly<Record<string, string>> = {
  valuation_policy_changed: 'Valuation policy changed',
  fx_rate_changed: 'Exchange rate changed',
  demand_status_changed: 'Demand status changed',
};

function triggerWords(trigger: string, reason: unknown): string {
  const key = typeof reason === 'string' ? reason : '';
  if (trigger === 'valuation_change' && VALUATION_REASON_LABELS[key]) return VALUATION_REASON_LABELS[key];
  return PROPOSAL_TRIGGER_LABELS[trigger] ?? humanize(trigger);
}

/** Why a change proposal opened, in plain words; a valuation change names the input that changed. */
export function proposalTriggerText(p: Pick<ChangeProposalView, 'trigger' | 'detail'>): string {
  return triggerWords(p.trigger, p.detail.reason);
}

/**
 * Every cause of a proposal, oldest first (`detail.triggers`, Marun E2E note D: a reused proposal keeps
 * its earlier causes); older proposals have only their stored trigger.
 */
export function proposalTriggersText(p: Pick<ChangeProposalView, 'trigger' | 'detail'>): string {
  const list = Array.isArray(p.detail.triggers) ? p.detail.triggers.filter(isRecord) : [];
  if (list.length === 0) return proposalTriggerText(p);
  const words = list.map((t) => triggerWords(typeof t.trigger === 'string' ? t.trigger : 'recalculation', t.reason));
  return words.filter((w, i) => w !== words[i - 1]).join(', then ');
}

/** A classification of the cause event a proposal changes (OEE component, schedule class, impact). */
export interface ProposalFieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

/** A loss line the proposal re-codes (`after.codingChanges`, server `proposal-coding.ts`). */
export interface ProposalCodingChange {
  autoKey: string;
  kind: string;
  quantity: string | null;
  before: string | null;
  after: string | null;
  /** changed cause classification (Marun regression R3); empty = the reason only */
  fields: ProposalFieldChange[];
}

const idOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

function fieldChangesOf(value: unknown): ProposalFieldChange[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .flatMap((f) => (typeof f.field === 'string' ? [{ field: f.field, before: idOrNull(f.before), after: idOrNull(f.after) }] : []));
}

/** The reason-code and classification changes of a proposal's "after" snapshot; empty for older proposals. */
export function proposalCodingChangesOf(snapshot: Record<string, unknown> | null): ProposalCodingChange[] {
  const list = snapshot?.codingChanges;
  if (!Array.isArray(list)) return [];
  return list.filter(isRecord).flatMap((c) =>
    typeof c.autoKey === 'string' && typeof c.kind === 'string'
      ? [
          {
            autoKey: c.autoKey,
            kind: c.kind,
            quantity: idOrNull(c.quantity),
            before: idOrNull(c.before),
            after: idOrNull(c.after),
            fields: fieldChangesOf(c.fields),
          },
        ]
      : [],
  );
}

const FIELD_NAMES: Readonly<Record<string, string>> = {
  oeeComponent: 'OEE component',
  scheduleClass: 'Schedule class',
  impactMode: 'Impact',
};

const FIELD_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  oeeComponent: OEE_COMPONENT_LABELS,
  scheduleClass: SCHEDULE_CLASS_LABELS,
  impactMode: IMPACT_MODE_LABELS,
};

/** "OEE component changed: Performance → Availability" — labels, never the stored tokens. */
export function proposalFieldChangeText(change: ProposalFieldChange): string {
  const values = FIELD_VALUES[change.field] ?? {};
  const name = FIELD_NAMES[change.field] ?? humanize(change.field);
  return `${name} changed: ${labelOf(values, change.before, 'none')} → ${labelOf(values, change.after, 'none')}`;
}

/** One currency of the approved loss value a proposal carries (`before.values`, server `proposal-values.ts`). */
export interface ProposalAmount {
  currency: string;
  amount: string | null;
  status: string;
}

export interface ProposalValues {
  view: string;
  amounts: ProposalAmount[];
}

function amountOf(value: unknown): ProposalAmount | null {
  if (!isRecord(value) || typeof value.currency !== 'string' || typeof value.status !== 'string') return null;
  return { currency: value.currency, amount: typeof value.amount === 'string' ? value.amount : null, status: value.status };
}

/** The approved value of a proposal snapshot, or null when the snapshot has none (older proposals, unvalued runs). */
export function proposalValuesOf(snapshot: Record<string, unknown> | null): ProposalValues | null {
  const values = snapshot?.values;
  if (!isRecord(values) || typeof values.view !== 'string' || !Array.isArray(values.amounts)) return null;
  return { view: values.view, amounts: values.amounts.map(amountOf).filter((a): a is ProposalAmount => a !== null) };
}

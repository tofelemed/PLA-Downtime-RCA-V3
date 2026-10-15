import type {
  CandidateView,
  DraftLineInput,
  EvidenceType,
  ManualKind,
  ReconciliationLineView,
  ReconciliationView,
} from '@/api/v2/types/reconciliation';
import { categoriesOf, needsEvidence } from './line-evidence';

/**
 * Editing state of the loss-line editor (plan 3.5, ACC07/ACC08): decisions on automatic candidates keyed
 * by `autoKey` and manual lines with a client key. The browser only keeps what the user chose and sends
 * the full set (`PUT …/draft-lines`); every total, residual and budget comes back from the server.
 */
export type DecisionAction = 'accept' | 'adjust' | 'replace' | 'reject';

export interface CandidateDecision {
  action: DecisionAction;
  quantity?: string;
  kind?: ManualKind;
  reasonCodeId?: string;
  reason?: string;
}

export interface ManualDraft {
  uid: string;
  sliceId: string;
  kind: ManualKind;
  quantity: string | null;
  reasonCodeId?: string;
  eventIds: string[];
  missingEvent: boolean;
  missingCode: boolean;
  reason?: string;
  comment?: string;
  classification?: string;
  evidenceType?: EvidenceType;
  evidenceRef?: string;
  /** SME R9: the approved line of an earlier period a reversal reverses */
  reversesLineId?: string;
}

export interface DraftState {
  decisions: Record<string, CandidateDecision>;
  manual: ManualDraft[];
  dirty: boolean;
}

/** Which editor row a payload line index (`details.issues[].line`) belongs to. */
export type LineRef = { type: 'decision'; autoKey: string } | { type: 'manual'; uid: string };

const CANDIDATE_ACTIONS = new Set<string>(['accept', 'adjust', 'replace', 'reject']);
let uidCounter = 0;
export const newUid = (): string => `m${Date.now().toString(36)}${(uidCounter += 1)}`;

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== '')) as T;

function decisionOf(line: ReconciliationLineView): CandidateDecision {
  return defined({
    action: line.action as DecisionAction,
    quantity: line.action === 'adjust' || line.action === 'replace' ? line.quantity ?? undefined : undefined,
    kind: line.action === 'replace' ? (line.kind as ManualKind) : undefined,
    reasonCodeId: line.reasonCodeId ?? undefined,
    reason: line.reason ?? undefined,
  });
}

function manualOf(line: ReconciliationLineView): ManualDraft {
  return {
    uid: line.id,
    sliceId: line.sliceId,
    kind: line.kind as ManualKind,
    quantity: line.quantity,
    reasonCodeId: line.reasonCodeId ?? undefined,
    eventIds: line.evidence.map((e) => e.eventId),
    missingEvent: line.missingEvent,
    missingCode: line.missingCode,
    reason: line.reason ?? undefined,
    comment: line.comment ?? undefined,
    classification: line.classification,
    evidenceType: line.evidenceType,
    evidenceRef: line.evidenceRef,
    reversesLineId: line.reversesLineId,
  };
}

/** The saved set of the view as editable state (tolerance lines are written by submit only). */
export function draftFromView(view: ReconciliationView): DraftState {
  const decisions: Record<string, CandidateDecision> = {};
  for (const line of view.lines) {
    if (CANDIDATE_ACTIONS.has(line.action) && line.autoKey) decisions[line.autoKey] = decisionOf(line);
  }
  return { decisions, manual: view.lines.filter((l) => l.action === 'manual').map(manualOf), dirty: false };
}

/** Sets or clears (null = back to the proposed candidate, ACC08 delete-override preview) a decision. */
export function setDecision(state: DraftState, autoKey: string, decision: CandidateDecision | null): DraftState {
  const decisions = { ...state.decisions };
  if (decision) decisions[autoKey] = decision;
  else delete decisions[autoKey];
  return { ...state, decisions, dirty: true };
}

export function addManual(state: DraftState, line: Omit<ManualDraft, 'uid'>): DraftState {
  return { ...state, manual: [...state.manual, { ...line, uid: newUid() }], dirty: true };
}

export function updateManual(state: DraftState, uid: string, patch: Partial<Omit<ManualDraft, 'uid'>>): DraftState {
  return { ...state, manual: state.manual.map((m) => (m.uid === uid ? { ...m, ...patch } : m)), dirty: true };
}

export function removeManual(state: DraftState, uid: string): DraftState {
  return { ...state, manual: state.manual.filter((m) => m.uid !== uid), dirty: true };
}

function decisionLine(autoKey: string, d: CandidateDecision): DraftLineInput {
  return defined({ action: d.action, autoKey, quantity: d.quantity, kind: d.action === 'replace' ? d.kind : undefined, reasonCodeId: d.reasonCodeId, reason: d.reason });
}

function manualLine(m: ManualDraft): DraftLineInput {
  return defined({
    action: 'manual' as const,
    sliceId: m.sliceId,
    kind: m.kind,
    quantity: m.quantity ?? undefined,
    reasonCodeId: m.reasonCodeId,
    eventIds: m.eventIds.length ? m.eventIds : undefined,
    missingEvent: m.missingEvent || undefined,
    missingCode: m.missingCode || undefined,
    reason: m.reason,
    comment: m.comment,
    classification: m.classification,
    evidenceType: m.evidenceType,
    evidenceRef: m.evidenceRef?.trim(),
    reversesLineId: m.kind === 'reversal' ? m.reversesLineId : undefined,
  });
}

/** The full set for `PUT …/draft-lines` in a stable order (candidates' order, then manual lines) and the row of each index. */
export function toPayload(state: DraftState, candidates: readonly CandidateView[]): { lines: DraftLineInput[]; refs: LineRef[] } {
  const keyed = candidates.filter((c) => state.decisions[c.autoKey]).map((c) => c.autoKey);
  const orphan = Object.keys(state.decisions).filter((k) => !keyed.includes(k));
  const keys = [...keyed, ...orphan];
  return {
    lines: [...keys.map((k) => decisionLine(k, state.decisions[k])), ...state.manual.map(manualLine)],
    refs: [...keys.map((autoKey): LineRef => ({ type: 'decision', autoKey })), ...state.manual.map((m): LineRef => ({ type: 'manual', uid: m.uid }))],
  };
}

/** After 409 RUN_CHANGED: keep the decisions whose candidate still exists in the new run; report the rest. */
export function rebaseDraft(state: DraftState, view: ReconciliationView): { state: DraftState; dropped: string[] } {
  const present = new Set(view.candidates.map((c) => c.autoKey));
  const decisions: Record<string, CandidateDecision> = {};
  const dropped: string[] = [];
  for (const [key, decision] of Object.entries(state.decisions)) {
    if (present.has(key)) decisions[key] = decision;
    else dropped.push(key);
  }
  return { state: { ...state, decisions, dirty: true }, dropped };
}

/** Shape problems the form shows before sending (required fields only — never totals or budgets). */
export function manualProblems(m: ManualDraft): string[] {
  if (m.kind === 'reversal') return reversalProblems(m);
  const problems: string[] = [];
  if (!m.quantity) problems.push('Enter a quantity.');
  if (!m.eventIds.length && !m.missingEvent) problems.push('Link an event or mark the cause as "no event".');
  if (m.missingEvent && !m.reasonCodeId && !m.missingCode) problems.push('Without an event, choose a reason code or mark the code as missing.');
  if (m.kind === 'bridge' && !m.reason?.trim()) problems.push('A bridge needs a written reason.');
  if (m.kind === 'bridge' && m.quantity?.trim().startsWith('-')) problems.push('A bridge cannot be negative: correct the over-claimed lines.');
  if (categoriesOf(m.kind).length && !m.classification) problems.push('Choose the category.');
  if (needsEvidence(m.kind, m.eventIds.length) && (!m.evidenceType || !m.evidenceRef?.trim())) problems.push('Name the evidence and its reference.');
  return problems;
}

/** SME R9: a reversal names the approved line, the record of the error and why; the server checks sign and size. */
function reversalProblems(m: ManualDraft): string[] {
  const problems: string[] = [];
  if (!m.reversesLineId) problems.push('Choose the approved line it reverses.');
  if (!m.quantity) problems.push('Enter a quantity (opposite sign of the reversed line).');
  if (!m.reason?.trim()) problems.push('A reversal needs a written reason.');
  if (!m.evidenceType || !m.evidenceRef?.trim()) problems.push('Name the evidence and its reference.');
  return problems;
}

export function decisionProblems(d: CandidateDecision): string[] {
  const problems: string[] = [];
  if (d.action !== 'accept' && !d.reason?.trim()) problems.push('A reason is required.');
  if ((d.action === 'adjust' || d.action === 'replace') && !d.quantity) problems.push('Enter the quantity.');
  if (d.action === 'replace' && !d.kind) problems.push('Choose the loss kind of the replacement.');
  return problems;
}

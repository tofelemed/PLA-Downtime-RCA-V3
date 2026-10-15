import type { PhysicalState, StateRule, UnitStateMappingBody, UnitStateMappingView } from '@/api/v2/types/reliability';

export const STATE_LABELS: Readonly<Record<PhysicalState, string>> = {
  running: 'Running',
  internal_stop: 'Stopped (internal)',
  planned_stop: 'Planned stop',
  starved: 'Starved (no input)',
  blocked: 'Blocked (no output)',
  standby: 'Standby',
  not_scheduled: 'Not scheduled',
};

export const PHYSICAL_STATES = Object.keys(STATE_LABELS) as PhysicalState[];

/** The editor's fields as typed (numbers stay text until saved). */
export interface MappingDraft {
  signalId: string;
  rules: StateRule[];
  expectedIntervalSeconds: string;
  jitterSeconds: string;
  staleAfterIntervals: string;
  isHeartbeat: boolean;
  effectiveFrom: string | null;
  notes: string;
}

const EMPTY_RULE: StateRule = { match: '', state: 'running' };

/** A new version starts from the version in force (or the SME D2 pilot defaults: 3 intervals, no jitter). */
export function draftOf(current: UnitStateMappingView | undefined): MappingDraft {
  return {
    signalId: current?.signalId ?? '',
    rules: current ? current.rules.map((r) => ({ ...r })) : [{ ...EMPTY_RULE }],
    expectedIntervalSeconds: current ? String(current.expectedIntervalSeconds) : '',
    jitterSeconds: current ? String(current.jitterSeconds) : '0',
    staleAfterIntervals: current ? String(current.staleAfterIntervals) : '3',
    isHeartbeat: current?.isHeartbeat ?? true,
    effectiveFrom: null,
    notes: '',
  };
}

export const withRule = (draft: MappingDraft): MappingDraft => ({ ...draft, rules: [...draft.rules, { ...EMPTY_RULE }] });

export const withoutRule = (draft: MappingDraft, index: number): MappingDraft => ({ ...draft, rules: draft.rules.filter((_, i) => i !== index) });

export const withRuleChange = (draft: MappingDraft, index: number, change: Partial<StateRule>): MappingDraft => ({
  ...draft,
  rules: draft.rules.map((rule, i) => (i === index ? { ...rule, ...change } : rule)),
});

const wholeNumber = (text: string, min: number, max: number): number | null => {
  const value = Number(text);
  return text.trim() !== '' && Number.isInteger(value) && value >= min && value <= max ? value : null;
};

export type MappingErrors = Partial<Record<'signalId' | 'rules' | 'expectedIntervalSeconds' | 'jitterSeconds' | 'staleAfterIntervals', string>>;

/** Field problems before sending (the server re-checks everything, including that the signal is a state signal). */
export function draftErrors(draft: MappingDraft): MappingErrors {
  const errors: MappingErrors = {};
  if (!draft.signalId) errors.signalId = 'Choose the state signal';
  if (draft.rules.length === 0 || draft.rules.some((r) => !r.match.trim())) errors.rules = 'Every rule needs a signal value';
  if (wholeNumber(draft.expectedIntervalSeconds, 1, 86400) === null) errors.expectedIntervalSeconds = 'Whole seconds from 1 to 86400';
  if (wholeNumber(draft.jitterSeconds, 0, 86400) === null) errors.jitterSeconds = 'Whole seconds from 0 to 86400';
  if (wholeNumber(draft.staleAfterIntervals, 1, 100) === null) errors.staleAfterIntervals = 'A whole number from 1 to 100';
  return errors;
}

/** The POST body of a valid draft. */
export function bodyOf(unitId: string, draft: MappingDraft): UnitStateMappingBody {
  return {
    unitId,
    signalId: draft.signalId,
    rules: draft.rules.map((r) => ({ match: r.match.trim(), state: r.state })),
    expectedIntervalSeconds: Number(draft.expectedIntervalSeconds),
    jitterSeconds: Number(draft.jitterSeconds),
    staleAfterIntervals: Number(draft.staleAfterIntervals),
    isHeartbeat: draft.isHeartbeat,
    ...(draft.effectiveFrom ? { effectiveFrom: draft.effectiveFrom } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
  };
}

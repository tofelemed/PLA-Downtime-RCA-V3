import type { CodingGateView } from '@/api/v2/types/stop-coding';

export interface GateWording {
  complete: string;
  incomplete: (blocking: boolean) => string;
  unit: { one: string; many: string };
  noReason: string;
  verifyButton: string;
}

const STOPS: GateWording = {
  complete: 'Stop coding complete',
  incomplete: (blocking) => (blocking ? 'Stop coding incomplete — submission is blocked' : 'Stop coding incomplete — shown as a warning'),
  unit: { one: 'stop', many: 'stops' },
  noReason: 'neither a reason nor “investigation pending”',
  verifyButton: 'Verify this shift’s stops',
};

const DECLARED: GateWording = {
  complete: 'Production loss coding complete',
  incomplete: (blocking) => (blocking ? 'Production loss coding incomplete — submission is blocked' : 'Production loss coding incomplete — shown as a warning'),
  unit: { one: 'loss event', many: 'loss events' },
  noReason: 'The day’s loss event has no reason',
  verifyButton: 'Verify this day’s loss coding',
};

/** The coding gate's words for the accounting basis; in declared mode the gate counts production loss events, not stops. */
export function gateWording(declared: boolean): GateWording {
  return declared ? DECLARED : STOPS;
}

export function gateVerdictText(gate: Pick<CodingGateView, 'passes' | 'mode'>, declared: boolean): string {
  const words = gateWording(declared);
  return gate.passes ? words.complete : words.incomplete(gate.mode === 'block');
}

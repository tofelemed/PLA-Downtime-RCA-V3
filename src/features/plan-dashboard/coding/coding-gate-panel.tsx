import { Button } from '@/components/ui/button';
import { useVerifyStops } from '@/api/v2/queries/stop-verification';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { CodingGateView } from '@/api/v2/types/stop-coding';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { formatRatioPercent } from '../model/display';

function gateVerdict(gate: CodingGateView): string {
  if (gate.passes) return 'Stop coding complete';
  return gate.mode === 'block' ? 'Stop coding incomplete — submission is blocked' : 'Stop coding incomplete — shown as a warning';
}

/** The failed rules in the plant's digits, from the server's counts (never computed here). */
function GateIssues({ gate }: { gate: CodingGateView }) {
  const { number, digits } = useNumberFormat();
  const codes = new Set(gate.issues.map((i) => i.code));
  return (
    <ul className="list-disc pl-5" data-testid="coding-gate-issues">
      {codes.has('STOPS_UNCODED') && <li data-code="STOPS_UNCODED">{number(gate.uncoded)} stop(s) have neither a reason nor “investigation pending”</li>}
      {codes.has('CODING_COVERAGE_LOW') && (
        <li data-code="CODING_COVERAGE_LOW">
          Coded stop time {formatRatioPercent(gate.codedRatio, digits)} is below the target {formatRatioPercent(gate.target, digits)}
        </li>
      )}
    </ul>
  );
}

/** SME D13: verify every coded (or investigation-pending) stop of this shift as its supervisor. */
function VerifyShiftButton({ periodId, unverified }: { periodId: string; unverified: number }) {
  const verify = useVerifyStops();
  const { number } = useNumberFormat();
  const outcome = verify.data;
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" data-testid="verify-shift" disabled={verify.isPending || unverified === 0} onClick={() => void verify.submit({ periodId }).catch(() => undefined)}>
        Verify this shift’s stops
      </Button>
      {outcome && (
        <p data-testid="verify-outcome">
          {number(outcome.done.length)} verified{outcome.skipped.length > 0 ? `, ${number(outcome.skipped.length)} skipped (not coded, already verified or coded by you)` : ''}
        </p>
      )}
      {verify.error ? <FriendlyErrorAlert error={verify.error} /> : null}
    </div>
  );
}

/**
 * Stop coding of the period (SME D12 / D13): the server's submission-gate verdict — every stop with a
 * reason or "investigation pending", coded stop time against the policy target — and how many stops still
 * wait for the supervisor's verification and maintenance's validation. Verification never blocks recording.
 */
export function CodingGatePanel({ view }: { view: ReconciliationView }) {
  const { canVerifyStops } = useCapabilities();
  const { number, digits } = useNumberFormat();
  const gate = view.codingGate;
  if (!gate || gate.stops === 0) return null;
  const v = gate.verification;
  return (
    <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="coding-gate" data-passes={gate.passes} data-mode={gate.mode}>
      <p className="font-medium">{gateVerdict(gate)}</p>
      <p>
        {number(gate.stops)} stops: {number(gate.coded)} with a reason, {number(gate.investigationPending)} investigation pending, {number(gate.uncoded)} uncoded · coded stop
        time {formatRatioPercent(gate.codedRatio, digits)} (target {formatRatioPercent(gate.target, digits)})
      </p>
      {!gate.passes && <GateIssues gate={gate} />}
      <p data-testid="coding-verification">
        Verified by a supervisor: {number(v.verified)} · waiting: {number(v.unverified)}
        {v.failureDetailed > 0 ? ` · failure detail validated by maintenance: ${number(v.validated)} of ${number(v.failureDetailed)}` : ''}
      </p>
      {canVerifyStops && <VerifyShiftButton periodId={view.periodId} unverified={v.unverified} />}
    </section>
  );
}

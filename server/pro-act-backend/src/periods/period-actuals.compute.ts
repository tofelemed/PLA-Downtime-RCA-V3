import { quantifySignal } from '../domain/actuals/signal-quantity';
import {
  CandidateSet,
  selectAuthority,
} from '../domain/actuals/period/authority';
import { externalLineCandidate } from '../domain/actuals/period/external-line-candidate';
import { distributeOutputEvents } from '../domain/actuals/period/output-distribution';
import {
  ActualsSource,
  ApprovedAdjustment,
  SliceActuals,
  SourceAuthorityPolicy,
  SourceCandidate,
  Window,
} from '../domain/actuals/period/period-actuals.types';
import { computeSliceActuals } from '../domain/actuals/period/slice-actuals';
import { signalCandidate } from '../domain/actuals/period/signal-candidate';
import { toDec, ZERO } from '../domain/actuals/decimal';
import { engineSignalOf } from '../signals/signal-preview.service';
import { ResolvedPolicies } from './accounting-policies.service';
import { PeriodInputs, SignalInput } from './actuals-inputs.loader';
import { ActualsAdjustment } from './entities/actuals-adjustment.entity';
import { PeriodProductSlice } from './entities/period-product-slice.entity';

/**
 * Actuals of every active slice of a period from loaded inputs (plan 2.4 step 2): candidates per policy
 * source — production output events, PI / MQTT / Kafka counter and rate signals (1.7 engine over the
 * slice window), certified external report lines — then one authority (`selectAuthority`) and the slice
 * result with approved adjustments (`computeSliceActuals`); SME E7 ranks naming one signal or a boundary
 * lag get their own candidate. Unit-level evidence (events, product-less
 * signals) is attributable only when no other slice shares the window (concurrent products, §3.1).
 */
export function computePeriodActuals(
  slices: readonly PeriodProductSlice[],
  inputs: PeriodInputs,
  policies: ResolvedPolicies,
): Map<string, SliceActuals> {
  const results = new Map<string, SliceActuals>();
  for (const slice of slices) {
    const window = { from: slice.windowFrom, to: slice.windowTo };
    const shared = slices.some(
      (other) =>
        other.id !== slice.id &&
        other.windowFrom < slice.windowTo &&
        other.windowTo > slice.windowFrom,
    );
    const set = candidatesOf(slice, window, inputs, { policies, shared });
    results.set(
      slice.id,
      computeSliceActuals({
        window,
        gate: policies.coverageGate,
        selection: selectAuthority(policies.sourceAuthority, set, window),
        adjustments: inputs.adjustments
          .filter((adjustment) => adjustment.sliceId === slice.id)
          .map(approvedOf),
        uom: slice.quantityUom,
        // SME E3 / E6: a lot belongs to one product, so it is attributable even when products share the window
        dispositions: (inputs.dispositions ?? []).filter(
          (lot) => lot.productId === slice.productId,
        ),
      }),
    );
  }
  return results;
}

function candidatesOf(
  slice: PeriodProductSlice,
  window: Window,
  inputs: PeriodInputs,
  context: { policies: ResolvedPolicies; shared: boolean },
): CandidateSet {
  const candidates: CandidateSet['candidates'] = {};
  const ambiguous: ActualsSource[] = [];
  candidates.pi_output_ef = context.shared
    ? unattributable('pi_output_ef', inputs.events.length > 0)
    : distributeOutputEvents(
        inputs.events,
        window,
        context.policies.coverageGate.allowProportionalEstimate,
        inputs.stops,
      );
  const bySource = new Map<ActualsSource, SignalInput[]>();
  for (const input of inputs.signals) {
    const product = input.signal.productId;
    if (product !== null && product !== slice.productId) continue;
    if (product === null && context.shared) continue;
    bySource.set(input.source, [...(bySource.get(input.source) ?? []), input]);
  }
  for (const [source, group] of bySource) {
    const chosen = authoritative(group);
    if (!chosen) ambiguous.push(source);
    else candidates[source] = signalCandidateOf(chosen, window);
  }
  const line = inputs.reportLines.find((l) => l.productId === slice.productId);
  if (line) candidates.external_report = externalLineCandidate(line, window);
  const byRank = rankedSignalCandidates(
    context.policies.sourceAuthority,
    bySource,
    window,
  );
  return { candidates, byRank, ambiguous };
}

/**
 * SME E7: candidates of hierarchy ranks that name one signal (a redundant meter of the same type) or read
 * a signal source over a window shifted by its boundary lag; the observed time is shifted back so
 * coverage is measured on the slice window.
 */
function rankedSignalCandidates(
  policy: SourceAuthorityPolicy,
  bySource: ReadonlyMap<ActualsSource, SignalInput[]>,
  window: Window,
): Record<number, SourceCandidate> {
  const byRank: Record<number, SourceCandidate> = {};
  for (const entry of policy.measurementHierarchy?.entries ?? []) {
    const lagSeconds = entry.boundaryAdjustment?.lagSeconds ?? 0;
    if (!entry.signalSourceKey && lagSeconds === 0) continue;
    const group = bySource.get(entry.source) ?? [];
    const chosen = entry.signalSourceKey
      ? group.find((input) => input.signal.sourceKey === entry.signalSourceKey)
      : authoritative(group);
    if (!chosen) continue;
    const lagMs = lagSeconds * 1000;
    const shifted = {
      from: new Date(window.from.getTime() + lagMs),
      to: new Date(window.to.getTime() + lagMs),
    };
    const candidate = signalCandidateOf(chosen, shifted);
    byRank[entry.rank] = {
      ...candidate,
      observed: candidate.observed.map((piece) => ({
        start: new Date(piece.start.getTime() - lagMs),
        end: new Date(piece.end.getTime() - lagMs),
      })),
    };
  }
  return byRank;
}

/** The flagged signal, else the only one; several unflagged → null (ambiguous, never summed). */
function authoritative(group: readonly SignalInput[]): SignalInput | null {
  const flagged = group.filter((input) => input.signal.isAuthority);
  if (flagged.length === 1) return flagged[0];
  if (flagged.length === 0 && group.length === 1) return group[0];
  return null;
}

function signalCandidateOf(
  input: SignalInput,
  window: Window,
): SourceCandidate {
  if (input.truncated) {
    return {
      ...unattributable(input.source, true),
      label: `signal:${input.signal.id}`,
      findings: [{ code: 'too_many_samples', severity: 'problem' }],
    };
  }
  const quantity = quantifySignal(
    input.samples,
    engineSignalOf(input.signal),
    window,
  );
  if (
    quantity.engine !== 'counter_delta' &&
    quantity.engine !== 'rate_integration'
  ) {
    return unattributable(input.source, false);
  }
  const candidate = signalCandidate(
    input.source,
    input.signal.id,
    quantity.result,
  );
  if (input.versions > 1) {
    candidate.findings.push({
      code: 'signal_version_change',
      severity: 'info',
      detail: { versions: input.versions, used: input.signal.version },
    });
  }
  return candidate;
}

/** A source that has data the slice cannot use (shared window, cap exceeded). */
function unattributable(
  source: ActualsSource,
  available: boolean,
): SourceCandidate {
  return {
    source,
    method: source === 'pi_output_ef' ? 'output_events' : 'counter_delta',
    label: source,
    basis: 'gross',
    quantity: null,
    reject: null,
    measured: ZERO,
    estimated: ZERO,
    uom: null,
    available,
    observed: [],
    segments: [],
    findings: available
      ? [
          {
            code: 'product_attribution_unavailable',
            severity: 'problem',
            detail: {
              reason:
                'unit-level evidence while several products share the window',
            },
          },
        ]
      : [],
  };
}

function approvedOf(adjustment: ActualsAdjustment): ApprovedAdjustment {
  return {
    id: adjustment.id,
    kind: adjustment.kind,
    quantity: toDec(adjustment.quantity) ?? ZERO,
    basis: adjustment.basis,
    window:
      adjustment.windowFrom && adjustment.windowTo
        ? { from: adjustment.windowFrom, to: adjustment.windowTo }
        : null,
  };
}

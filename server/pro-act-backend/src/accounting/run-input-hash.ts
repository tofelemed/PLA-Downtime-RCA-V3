import { createHash } from 'crypto';
import { ACCOUNTING_ENGINE_VERSION } from '../domain/accounting/period-accounting';
import { KPI_ENGINE_VERSION } from '../domain/kpi/period-kpis';
import { VALUATION_ENGINE_VERSION } from '../domain/valuation/valuation.types';
import { EnginePolicies } from '../periods/accounting-policies.service';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { LoadedValuation } from '../valuation/valuation-context.loader';
import { AccountingInputs } from './accounting-inputs.loader';
import { kpiHashMaterial } from './kpi-inputs.loader';

/** Recorded on every run: the ledger engine (2.5), the KPI engine (2.7) and the valuation (2.6) it applied. */
export const RUN_ENGINE_VERSION = `${ACCOUNTING_ENGINE_VERSION}+kpi.${KPI_ENGINE_VERSION}+val.${VALUATION_ENGINE_VERSION}`;

/** sha256 over the fingerprint and every value the engine reads that an id does not pin down. */
export function hashOf(
  period: ProductionPeriod,
  inputs: AccountingInputs,
  policies: { engine: EnginePolicies; valuation: LoadedValuation },
): string {
  const material = {
    engine: RUN_ENGINE_VERSION,
    policies: policies.engine.refs,
    valuation: policies.valuation.context,
    kpi: kpiHashMaterial(inputs.kpi),
    fingerprint: inputs.fingerprint,
    // master data read through an event's ids (SME D6): the asset type picks the micro-stop threshold and
    // the reason code marks a trip, so re-typing an asset or recoding a reason changes the inputs
    classification: inputs.events.map((e) => [
      e.eventId,
      e.assetClass ?? null,
      e.reasonCode ?? null,
    ]),
    excluded: [period.isExcluded, period.exclusionKind],
    schedule: inputs.schedule.map((s) => [
      s.start.getTime(),
      s.end.getTime(),
      s.excluded,
      s.exclusionKind,
    ]),
    // a superseded standard keeps its id but its window closes (LA-08)
    transitionStandards: inputs.transitionStandards.map((s) => [
      s.id,
      s.referenceSeconds,
      s.referenceOffgradeQuantity,
      s.from.getTime(),
      s.to?.getTime() ?? null,
    ]),
    // SME E6: a run's end or a stream's share can change under the same ids
    ...(inputs.streamRuns.length > 0
      ? {
          streams: inputs.streamRuns.map((r) => [
            r.streamId,
            r.productId,
            r.share,
            r.start.getTime(),
            r.end?.getTime() ?? null,
          ]),
        }
      : {}),
    slices: inputs.slices.map((s) => [
      s.sliceId,
      s.window.start.getTime(),
      s.window.end.getTime(),
      s.uom,
      s.target,
    ]),
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

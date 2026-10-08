import { SignalBackfillRun } from '../../signals/entities/signal-backfill-run.entity';
import { Signal } from '../../signals/entities/signal.entity';
import { SignalPreview } from '../../signals/signal-preview.service';

export interface SignalV2View {
  id: string;
  connectionId: string;
  name: string;
  sourceKey: string;
  sourceBinding: Record<string, unknown>;
  unitId: string;
  assetId: string | null;
  productId: string | null;
  semanticType: string;
  canonicalUom: string | null;
  rateTimebase: string | null;
  interpolation: string;
  maxGapSeconds: number;
  resetPolicy: string;
  rolloverModulus: string | null;
  expectedMin: string | null;
  expectedMax: string | null;
  cadenceSeconds: number | null;
  qualityPolicy: Record<string, unknown>;
  isAuthority: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  rowVersion: number;
  createdAt: string;
}

export function toSignalView(signal: Signal): SignalV2View {
  return {
    id: signal.id,
    connectionId: signal.connectionId,
    name: signal.name,
    sourceKey: signal.sourceKey,
    sourceBinding: { ...signal.sourceBinding },
    unitId: signal.unitId,
    assetId: signal.assetId,
    productId: signal.productId,
    semanticType: signal.semanticType,
    canonicalUom: signal.canonicalUom,
    rateTimebase: signal.rateTimebase,
    interpolation: signal.interpolation,
    maxGapSeconds: signal.maxGapSeconds,
    resetPolicy: signal.resetPolicy,
    rolloverModulus: signal.rolloverModulus,
    expectedMin: signal.expectedMin,
    expectedMax: signal.expectedMax,
    cadenceSeconds: signal.cadenceSeconds,
    qualityPolicy: { ...signal.qualityPolicy },
    isAuthority: signal.isAuthority,
    effectiveFrom: signal.effectiveFrom.toISOString(),
    effectiveTo: signal.effectiveTo ? signal.effectiveTo.toISOString() : null,
    version: signal.version,
    rowVersion: signal.rowVersion,
    createdAt: signal.createdAt.toISOString(),
  };
}

/** Preview answer: the engine result with method, coverage and exceptions, plus the samples it used. */
export interface SignalPreviewV2View {
  signalId: string;
  window: { from: string; to: string };
  engine: string;
  result: unknown;
  samples: Array<{
    observedAt: string;
    value: string | null;
    stateName: string | null;
    quality: string;
    sourceRevision: string;
    revisions: number;
    inWindow: boolean;
  }>;
  piTotals: Array<{
    periodStart: string;
    periodEnd: string;
    total: string | null;
    quality: string;
    timebase: string;
  }>;
}

export function toPreviewView(
  signal: Signal,
  preview: SignalPreview,
): SignalPreviewV2View {
  const from = preview.window.from.getTime();
  const to = preview.window.to.getTime();
  const quantity = preview.quantity;
  return {
    signalId: signal.id,
    window: {
      from: preview.window.from.toISOString(),
      to: preview.window.to.toISOString(),
    },
    engine: quantity.engine,
    result:
      quantity.engine === 'none'
        ? { exceptions: quantity.exceptions }
        : quantity.result,
    samples: preview.samples.map((sample) => ({
      observedAt: sample.observedAt.toISOString(),
      value: sample.value,
      stateName: sample.stateName,
      quality: sample.quality,
      sourceRevision: sample.sourceRevision,
      revisions: sample.revisions,
      inWindow:
        sample.observedAt.getTime() >= from && sample.observedAt.getTime() < to,
    })),
    piTotals: preview.piTotals.map((total) => ({
      periodStart: total.periodStart.toISOString(),
      periodEnd: total.periodEnd.toISOString(),
      total: total.total,
      quality: total.quality,
      timebase: total.timebase,
    })),
  };
}

export interface SignalBackfillV2View {
  id: string;
  signalId: string;
  from: string;
  to: string;
  state: string;
  reason: string;
  ingestionJobId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export function toBackfillView(run: SignalBackfillRun): SignalBackfillV2View {
  return {
    id: run.id,
    signalId: run.signalId,
    from: run.fromTime.toISOString(),
    to: run.toTime.toISOString(),
    state: run.state,
    reason: run.reason,
    ingestionJobId: run.ingestionJobId,
    detail: run.detail,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

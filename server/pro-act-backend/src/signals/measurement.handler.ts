import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { CanonicalEnvelope } from '../intake/envelope/canonical-envelope';
import { IngestionErrorCode } from '../intake/entities/ingestion-exception.entity';
import {
  NormalizationHandler,
  NormalizationHandlerRegistry,
  NormalizationInput,
  NormalizationResult,
} from '../intake/normalization/normalization-handler';
import { Signal } from './entities/signal.entity';
import { parseMeasurement, sameUnit } from './measurement-value';
import { SampleStore } from './sample-store';

/**
 * Normaliser of measurement envelopes of any connector (plan 1.7 step 5, §5.1): the sample is bound to
 * the signal version effective at its timestamp (`source_key` = `values.sample.signalRef`) and stored as
 * a versioned sample — or, for a source summary, as a `signal_summaries` row. Unknown signals
 * (`unknown_signal`), a sample unit other than the signal's canonical unit (`unit_conflict`, no
 * conversion is guessed) and summaries of non-rate signals or with another timebase are quarantined; replay places
 * them once the signal is configured. Idempotent: the same raw record stores nothing new.
 */
@Injectable()
export class MeasurementHandler implements NormalizationHandler, OnModuleInit {
  readonly name = 'measurement';

  constructor(
    private readonly registry: NormalizationHandlerRegistry,
    private readonly store: SampleStore,
    @InjectRepository(Signal) private readonly signals: Repository<Signal>,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(envelope: CanonicalEnvelope): boolean {
    return envelope.kind === 'measurement' && envelope.operation !== 'retract';
  }

  async handle(input: NormalizationInput): Promise<NormalizationResult> {
    const { envelope } = input;
    const sample = envelope.values?.sample;
    if (!sample) return quarantine('processing_failed', 'no sample');
    const signal = await this.signalAt(envelope, sample.signalRef);
    if (!signal) {
      return quarantine('unknown_signal', 'no signal is bound to this source', {
        signalRef: sample.signalRef,
        observedAt: envelope.observedAt,
      });
    }
    if (sample.semanticType === 'state' && signal.semanticType !== 'state') {
      return quarantine(
        'mapping_invalid_target',
        'Machine-state topics must bind to a state signal',
      );
    }
    // a summary's unit is the integrated one (t for t/h); its basis is checked by timebase instead
    const unitChecked = !sample.summary && sample.unit && signal.canonicalUom;
    if (
      unitChecked &&
      !sameUnit(sample.unit as string, signal.canonicalUom as string)
    ) {
      return quarantine(
        'unit_conflict',
        'sample unit differs from the canonical unit',
        {
          signalId: signal.id,
          unit: sample.unit,
          canonicalUom: signal.canonicalUom,
        },
      );
    }
    return sample.summary
      ? this.storeSummary(input, signal)
      : this.storeSample(input, signal);
  }

  /** The signal version whose effective interval holds the sample time. */
  private signalAt(
    envelope: CanonicalEnvelope,
    sourceKey: string,
  ): Promise<Signal | null> {
    const at = new Date(envelope.observedAt);
    const base = {
      tenantId: envelope.tenantId,
      connectionId: envelope.connectionId,
      sourceKey,
      effectiveFrom: LessThanOrEqual(at),
    };
    return this.signals.findOne({
      where: [
        { ...base, effectiveTo: IsNull() },
        { ...base, effectiveTo: MoreThan(at) },
      ],
      order: { effectiveFrom: 'DESC' },
    });
  }

  private async storeSample(
    input: NormalizationInput,
    signal: Signal,
  ): Promise<NormalizationResult> {
    const { envelope, raw } = input;
    const parsed = parseMeasurement(envelope);
    const stored = await this.store.insertSample({
      ...parsed,
      tenantId: envelope.tenantId,
      signalId: signal.id,
      observedAt: new Date(envelope.observedAt),
      rawId: raw.id,
      rawReceivedAt: raw.receivedAt,
      sourceRevision: envelope.sourceRevision ?? envelope.messageId,
    });
    return {
      status: 'applied',
      outcome: stored ? 'sample_stored' : 'sample_unchanged',
      canonicalEventId: null,
      detail: { signalId: signal.id, quality: parsed.quality },
    };
  }

  /** PI09: a Total is stored only for a rate signal and the timebase it was validated against. */
  private async storeSummary(
    input: NormalizationInput,
    signal: Signal,
  ): Promise<NormalizationResult> {
    const { envelope, raw } = input;
    const problem = summaryProblem(envelope, signal);
    if (problem) return problem;
    const parsed = parseMeasurement(envelope);
    const stored = await this.store.insertSummary({
      tenantId: envelope.tenantId,
      signalId: signal.id,
      periodStart: new Date(envelope.startTime as string),
      periodEnd: new Date(envelope.endTime as string),
      total: parsed.value,
      timebase: signal.rateTimebase as string,
      quality: parsed.quality,
      rawId: raw.id,
      rawReceivedAt: raw.receivedAt,
      sourceRevision: envelope.sourceRevision ?? envelope.messageId,
    });
    return {
      status: 'applied',
      outcome: stored ? 'summary_stored' : 'summary_unchanged',
      canonicalEventId: null,
      detail: { signalId: signal.id },
    };
  }
}

/** Why a summary cannot be stored for this signal (non-rate, no interval, another timebase). */
function summaryProblem(
  envelope: CanonicalEnvelope,
  signal: Signal,
): NormalizationResult | null {
  const summary = envelope.values?.sample?.summary;
  const interval = Boolean(envelope.startTime && envelope.endTime);
  if (!summary || signal.semanticType !== 'rate' || !interval) {
    return quarantine(
      'mapping_invalid_target',
      'summaries are accepted for rate signals only',
      { signalId: signal.id, semanticType: signal.semanticType },
    );
  }
  if (summary.timebase === signal.rateTimebase) return null;
  return quarantine(
    'unit_conflict',
    'summary timebase differs from the signal timebase',
    {
      signalId: signal.id,
      timebase: summary.timebase,
      rateTimebase: signal.rateTimebase,
    },
  );
}

function quarantine(
  errorCode: IngestionErrorCode,
  reason: string,
  detail: Record<string, unknown> = {},
): NormalizationResult {
  return {
    status: 'quarantined',
    outcome: errorCode,
    errorCode,
    detail: { reason, ...detail },
  };
}

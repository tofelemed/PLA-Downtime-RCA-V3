import {
  EngineException,
  EngineSample,
  EngineSignal,
  QuantityResult,
  TimeWindow,
} from './actuals.types';
import { counterDelta, CounterOptions } from './counter-delta';
import { OutputResult, outputEvents } from './output-events';
import { integrateRate } from './rate-integration';

export type SignalQuantity =
  | { engine: 'counter_delta' | 'rate_integration'; result: QuantityResult }
  | { engine: 'output_events'; result: OutputResult }
  | { engine: 'none'; exceptions: EngineException[] };

/**
 * The engine function for a signal's semantic type (preview now, period results in 2.4): counters →
 * `counterDelta`, rates → `integrateRate`, output increments → `outputEvents` (each usable sample is one
 * increment, identified by its timestamp). Other types carry no quantity.
 */
export function quantifySignal(
  samples: EngineSample[],
  signal: EngineSignal,
  window: TimeWindow,
  options: CounterOptions = {},
): SignalQuantity {
  if (signal.semanticType === 'counter') {
    return {
      engine: 'counter_delta',
      result: counterDelta(samples, signal, window, options),
    };
  }
  if (signal.semanticType === 'rate') {
    return {
      engine: 'rate_integration',
      result: integrateRate(samples, signal, window),
    };
  }
  if (signal.semanticType === 'output_increment') {
    return {
      engine: 'output_events',
      result: incrementsOf(samples, signal, window),
    };
  }
  return {
    engine: 'none',
    exceptions: [
      {
        code: 'wrong_semantic_type',
        detail: {
          expected: ['counter', 'rate', 'output_increment'],
          actual: signal.semanticType,
        },
      },
    ],
  };
}

function incrementsOf(
  samples: EngineSample[],
  signal: EngineSignal,
  window: TimeWindow,
): OutputResult {
  const usable = (sample: EngineSample) =>
    sample.quality === 'good' ||
    (sample.quality === 'uncertain' && signal.acceptUncertain === true);
  const result = outputEvents(
    samples.filter(usable).map((sample) => ({
      identity: sample.at.toISOString(),
      at: sample.at,
      quantity: sample.value,
    })),
    window,
  );
  const unusable = samples.filter((sample) => {
    const at = sample.at.getTime();
    return (
      !usable(sample) && at >= window.from.getTime() && at < window.to.getTime()
    );
  });
  const excluded: EngineException[] = unusable.map((sample) => ({
    code: 'bad_quality',
    from: sample.at.toISOString(),
    detail: { quality: sample.quality },
  }));
  return { ...result, exceptions: [...result.exceptions, ...excluded] };
}

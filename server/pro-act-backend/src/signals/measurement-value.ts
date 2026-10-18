import { CanonicalEnvelope } from '../intake/envelope/canonical-envelope';
import { SampleQualityValue } from './entities/measurement-sample.entity';

/** What a measurement envelope stores: numeric value or digital state, quality and its flags. */
export interface ParsedMeasurement {
  value: string | null;
  stateName: string | null;
  stateValue: number | null;
  quality: SampleQualityValue;
  qualityFlags: string[] | null;
}

const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const MAX_ABS = 1e16;

/**
 * The stored form of `values.sample` (plan 1.7 step 5). Numbers (or numeric strings) become the value;
 * a digital state keeps name and code; any other value cannot be a quantity and is stored as `bad` with a
 * `non_numeric` flag (kept, never guessed). Values beyond `numeric(24,8)` are `bad` (`out_of_bounds`).
 */
export function parseMeasurement(
  envelope: CanonicalEnvelope,
): ParsedMeasurement {
  const sample = envelope.values?.sample;
  const flags = [...(envelope.quality.sourceFlags ?? [])];
  const base = {
    value: null,
    stateName: null,
    stateValue: null,
    quality: envelope.quality.status,
  };
  if (
    sample?.semanticType === 'state' &&
    typeof sample.value === 'string' &&
    sample.value.trim()
  ) {
    return {
      ...base,
      stateName: sample.value,
      qualityFlags: flags.length > 0 ? flags : null,
    };
  }
  if (sample?.digital) {
    return {
      ...base,
      stateName: sample.digital.name,
      stateValue: sample.digital.value,
      qualityFlags: flags.length > 0 ? flags : null,
    };
  }
  const value = numericText(sample?.value);
  if (value === null) {
    const flag = sample?.value === null ? 'no_value' : 'non_numeric';
    return { ...base, quality: 'bad', qualityFlags: [...flags, flag] };
  }
  if (Math.abs(Number(value)) >= MAX_ABS) {
    return {
      ...base,
      quality: 'bad',
      qualityFlags: [...flags, 'out_of_bounds'],
    };
  }
  return { ...base, value, qualityFlags: flags.length > 0 ? flags : null };
}

function numericText(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'string' && NUMERIC.test(value.trim())) {
    return value.trim();
  }
  return null;
}

/** Units compare case-insensitively and without spaces (`t/h` = `T/H`); no conversion is ever applied. */
export function sameUnit(a: string, b: string): boolean {
  const key = (unit: string) => unit.replace(/\s+/g, '').toLowerCase();
  return key(a) === key(b);
}

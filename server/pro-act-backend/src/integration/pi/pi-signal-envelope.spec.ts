import { validateEnvelope } from '../../intake/envelope/envelope-validator';
import {
  piQuality,
  piSampleEnvelope,
  piSummaryEnvelope,
} from './pi-signal-envelope';

const binding = {
  tenantId: '0b5a6f3e-2d4c-4b8a-9e1f-7c6d5e4f3a2b',
  connectionId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
};
const read = (ms: number) => ({
  webId: 'P1',
  at: new Date(ms),
  correlationId: 'test',
});
const value = (overrides: Record<string, unknown> = {}) => ({
  Timestamp: '2026-10-08T06:00:00Z',
  Value: 12.5,
  UnitsAbbreviation: 't/h',
  Good: true,
  ...overrides,
});
const system = (name: string, code: number) => ({
  Name: name,
  Value: code,
  IsSystem: true,
});

describe('PI measurement envelopes (plan 1.7 step 5)', () => {
  it.each([
    [{}, 'good', undefined],
    [{ Questionable: true }, 'uncertain', ['questionable']],
    [
      { Substituted: true, Annotated: true },
      'uncertain',
      ['substituted', 'annotated'],
    ],
    [{ Good: false }, 'bad', undefined],
    [
      { Good: false, Value: system('I/O Timeout', 246) },
      'bad',
      ['system:I/O Timeout'],
    ],
    [{ Value: system('No Data', 248) }, 'missing', ['system:No Data']],
  ])('maps PI quality %j to %s', (overrides, status, flags) => {
    const quality = piQuality(value(overrides));
    expect(quality.status).toBe(status);
    expect(quality.sourceFlags).toEqual(flags);
  });

  it('identity: object = WebId@timestamp, revision = read time; an unchanged re-read has the same message id', () => {
    const first = piSampleEnvelope(binding, value(), read(1000));
    const reread = piSampleEnvelope(binding, value(), read(2000));
    const corrected = piSampleEnvelope(
      binding,
      value({ Value: 13 }),
      read(3000),
    );

    expect(validateEnvelope(first).valid).toBe(true);
    expect(first).toMatchObject({
      kind: 'measurement',
      sourceObjectId: 'P1@2026-10-08T06:00:00.000Z',
      observedAt: '2026-10-08T06:00:00.000Z',
      sourceRevision: '1000',
      values: { sample: { signalRef: 'P1', value: 12.5, unit: 't/h' } },
    });
    expect(reread.messageId).toBe(first.messageId);
    expect(corrected.messageId).not.toBe(first.messageId);
    expect(corrected.sourceObjectId).toBe(first.sourceObjectId);
  });

  it('digital states keep name and code with a null value', () => {
    const envelope = piSampleEnvelope(
      binding,
      value({ Value: { Name: 'Running', Value: 1, IsSystem: false } }),
      read(1000),
    );
    expect(validateEnvelope(envelope).valid).toBe(true);
    expect(envelope.values?.sample).toMatchObject({
      value: null,
      digital: { name: 'Running', value: 1, isSystem: false },
    });
  });

  it('a Total is a measurement over [start, end) with its validated basis', () => {
    const envelope = piSummaryEnvelope(
      binding,
      {
        value: value({ Value: 60, UnitsAbbreviation: 't' }),
        start: '2026-10-08T06:00:00.000Z',
        end: '2026-10-08T07:00:00.000Z',
        timebase: 'h',
      },
      read(1000),
    );
    expect(validateEnvelope(envelope).valid).toBe(true);
    expect(envelope).toMatchObject({
      sourceObjectId:
        'P1#Total@2026-10-08T06:00:00.000Z/2026-10-08T07:00:00.000Z',
      startTime: '2026-10-08T06:00:00.000Z',
      endTime: '2026-10-08T07:00:00.000Z',
      values: {
        sample: {
          summary: {
            summaryType: 'Total',
            calculationBasis: 'TimeWeighted',
            timebase: 'h',
          },
        },
      },
    });
  });
});

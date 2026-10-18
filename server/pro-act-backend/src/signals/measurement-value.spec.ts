import { CanonicalEnvelope } from '../intake/envelope/canonical-envelope';
import { parseMeasurement } from './measurement-value';

describe('digital state measurements', () => {
  it.each(['good', 'bad', 'uncertain', 'missing'] as const)(
    'preserves %s source quality without inventing a numeric code',
    (status) => {
      const envelope = {
        values: { sample: { value: 'STOP', semanticType: 'state' } },
        quality: { status, sourceFlags: ['source_evidence'] },
      } as unknown as CanonicalEnvelope;
      expect(parseMeasurement(envelope)).toEqual({
        value: null,
        stateName: 'STOP',
        stateValue: null,
        quality: status,
        qualityFlags: ['source_evidence'],
      });
    },
  );
  it('does not turn arbitrary numeric measurement text into a good state', () => {
    const envelope = {
      values: { sample: { value: 'STOP', semanticType: 'rate' } },
      quality: { status: 'good' },
    } as unknown as CanonicalEnvelope;
    expect(parseMeasurement(envelope)).toMatchObject({
      stateName: null,
      value: null,
      quality: 'bad',
      qualityFlags: ['non_numeric'],
    });
  });
});

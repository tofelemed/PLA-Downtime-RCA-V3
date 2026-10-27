import { CanonicalEnvelope } from '../../../envelope/canonical-envelope';
import { declaredFiguresOf } from './pla-declared-figures';

function envelopeWith(
  attributes: NonNullable<CanonicalEnvelope['values']>['attributes'],
): CanonicalEnvelope {
  return { values: { attributes } } as unknown as CanonicalEnvelope;
}

describe('declaredFiguresOf', () => {
  it('builds the figures with plan and PI provenance and the status', () => {
    const result = declaredFiguresOf(
      envelopeWith([
        { name: 'Planned', type: 'number', value: 240, unit: 't' },
        { name: 'Actual', type: 'number', value: 208, unit: 't' },
        { name: 'Shortfall', type: 'number', value: 32, unit: 't' },
        { name: 'Status', type: 'string', value: 'CONFIRMED' },
        { name: 'PlanId', type: 'string', value: 'P1' },
        { name: 'PlanApproved', type: 'boolean', value: true },
        { name: 'PiActualTag', type: 'string', value: 'TAG' },
      ]),
    );
    expect(result).toEqual({
      figures: {
        planned: 240,
        actual: 208,
        shortfall: 32,
        uom: 't',
        measurementQuality: null,
        sourceStatus: 'CONFIRMED',
        plan: { source: null, planId: 'P1', revision: null, approved: true },
        piSource: { actualTag: 'TAG', eventFrameId: null },
      },
    });
  });

  it('defaults the status to REPORTED and leaves absent provenance null', () => {
    const result = declaredFiguresOf(
      envelopeWith([
        { name: 'Shortfall', type: 'number', value: 0, unit: 't' },
      ]),
    );
    expect(result).toMatchObject({
      figures: { sourceStatus: 'REPORTED', plan: null, piSource: null },
    });
  });

  it('refuses a missing and a negative shortfall', () => {
    expect(declaredFiguresOf(envelopeWith([]))).toEqual({
      reason: 'The PLA message carries no shortfall',
    });
    expect(
      declaredFiguresOf(
        envelopeWith([{ name: 'Shortfall', type: 'number', value: -1 }]),
      ),
    ).toEqual({
      reason: 'shortfall must be ≥ 0; overproduction is not a loss',
    });
  });
});

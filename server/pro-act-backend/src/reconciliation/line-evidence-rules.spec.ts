import { DraftLineInput } from './draft-line.input';
import { assertManualLineRules } from './line-evidence-rules';
import { UnprocessableEntityException } from '@nestjs/common';

const manual = (patch: Partial<DraftLineInput>): DraftLineInput => ({
  action: 'manual',
  sliceId: 's1',
  quantity: '10',
  reason: 'why',
  ...patch,
});

function codeOf(input: DraftLineInput, mayBridge = true): string | undefined {
  try {
    assertManualLineRules(input, 0, { mayBridge });
    return undefined;
  } catch (error) {
    if (!(error instanceof UnprocessableEntityException)) return 'unexpected';
    return (error.getResponse() as { code: string }).code;
  }
}

describe('manual line rules (SME R7, R8, R9, R11)', () => {
  it('R11: a stop without an event needs a log or work order reference; an event is enough on its own', () => {
    expect(codeOf(manual({ kind: 'availability', missingEvent: true }))).toBe(
      'EVIDENCE_REQUIRED',
    );
    expect(
      codeOf(
        manual({
          kind: 'availability',
          missingEvent: true,
          evidenceType: 'work_order',
          evidenceRef: 'WO-4711',
        }),
      ),
    ).toBeUndefined();
    expect(
      codeOf(manual({ kind: 'availability', eventIds: ['e1'] })),
    ).toBeUndefined();
  });

  it('R11: the evidence type must suit the kind (a photo-like log is no proof of an off-spec quantity)', () => {
    expect(
      codeOf(
        manual({
          kind: 'quality',
          missingEvent: true,
          evidenceType: 'log',
          evidenceRef: 'shift log',
        }),
      ),
    ).toBe('EVIDENCE_TYPE_NOT_ALLOWED');
    expect(
      codeOf(
        manual({
          kind: 'quality',
          missingEvent: true,
          evidenceType: 'lot_sample',
          evidenceRef: 'L-204 / B-108',
        }),
      ),
    ).toBeUndefined();
    expect(
      codeOf(
        manual({
          kind: 'performance',
          missingEvent: true,
          evidenceType: 'totalizer',
          evidenceRef: 'FT-101 delta',
        }),
      ),
    ).toBeUndefined();
  });

  it('R7: an Unaccounted line names its category and the investigation', () => {
    const base = {
      kind: 'unaccounted_classified' as const,
      missingEvent: true,
      evidenceType: 'investigation_note' as const,
      evidenceRef: 'meter check pending',
    };
    expect(codeOf(manual(base))).toBe('CATEGORY_REQUIRED');
    expect(
      codeOf(manual({ ...base, classification: 'source_data_gap' })),
    ).toBeUndefined();
    expect(codeOf(manual({ ...base, classification: 'inventory' }))).toBe(
      'CATEGORY_NOT_ALLOWED',
    );
  });

  it('R8 / R9: a bridge is production accounting only, has a category and evidence, and is never negative', () => {
    const bridge = {
      kind: 'bridge' as const,
      missingEvent: true,
      classification: 'inventory',
      evidenceType: 'movement_record' as const,
      evidenceRef: 'silo 3 stock +2 t',
    };
    expect(codeOf(manual(bridge))).toBeUndefined();
    expect(codeOf(manual(bridge), false)).toBe('BRIDGE_NOT_ALLOWED');
    expect(codeOf(manual({ ...bridge, quantity: '-20' }))).toBe(
      'NEGATIVE_BRIDGE',
    );
    expect(codeOf(manual({ ...bridge, classification: undefined }))).toBe(
      'CATEGORY_REQUIRED',
    );
  });

  it('a category is only for bridge and Unaccounted lines', () => {
    expect(
      codeOf(
        manual({
          kind: 'availability',
          eventIds: ['e1'],
          classification: 'timing',
        }),
      ),
    ).toBe('CATEGORY_NOT_ALLOWED');
  });
});

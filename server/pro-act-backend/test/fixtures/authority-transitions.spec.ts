import {
  AuthorityRole,
  authorityTransitions,
  newTransitions,
  RunSlice,
} from '../../src/domain/actuals/period/authority-transitions';
import { SourceSubstitution } from '../../src/domain/actuals/period/period-actuals.types';

/**
 * Plan 1.10 step 5 (SRC01, T12): the fallback banner. Shift A of unit A1 is measured by its PI output
 * frames (rank 1); in shift B the frames stop and the MQTT counter (rank 2) gives the actuals — the
 * fallback is activated; in shift C the frames are back — the fallback ends and, since both sources
 * quantified C and differ, the run's source conflict is carried (primary kept, never summed). A rerun of
 * a period with the same outcome publishes nothing new.
 */
const at = (hour: number) => new Date(Date.UTC(2027, 2, 1, hour));

const SUBSTITUTION: SourceSubstitution = {
  used: {
    rank: 2,
    sourceClass: null,
    source: 'mqtt',
    boundary: null,
    label: 'MQTT counter',
  },
  replaced: {
    rank: 1,
    sourceClass: null,
    source: 'pi_output_ef',
    boundary: null,
  },
  reason: 'primary_missing',
  crossBoundary: null,
};

const CONFLICT = {
  code: 'source_conflict',
  severity: 'problem' as const,
  detail: {
    selected: 'PI frames',
    selectedQuantity: '850',
    other: 'MQTT counter',
    otherQuantity: '842',
    tolerance: 0,
  },
};

const slice = (
  id: string,
  hour: number,
  kind: 'primary' | 'fallback' | 'none',
  conflict = false,
): RunSlice => ({
  sliceId: id,
  productId: 'P1',
  start: at(hour),
  actuals: {
    substitution: kind === 'fallback' ? SUBSTITUTION : null,
    gross: kind === 'none' ? null : '850',
    good: kind === 'none' ? null : '840',
    findings: conflict ? [CONFLICT] : [],
  },
});

const PRIMARY: AuthorityRole = {
  role: 'primary',
  used: null,
  replaced: null,
  reason: null,
};

describe('fallback banner transitions (plan 1.10 step 5, SRC01)', () => {
  it('shift B on the MQTT counter after shift A on PI frames: the fallback is activated', () => {
    const transitions = authorityTransitions(new Map([['P1', PRIMARY]]), [
      slice('B', 8, 'fallback'),
    ]);
    expect(transitions).toEqual([
      {
        kind: 'activated',
        sliceId: 'B',
        productId: 'P1',
        used: SUBSTITUTION.used,
        replaced: SUBSTITUTION.replaced,
        reason: 'primary_missing',
        conflict: null,
      },
    ]);
  });

  it('shift C back on PI frames: the fallback ends and the conflict of C is carried (primary kept)', () => {
    const preceding = new Map<string, AuthorityRole>([
      [
        'P1',
        {
          role: 'fallback',
          used: SUBSTITUTION.used,
          replaced: SUBSTITUTION.replaced,
          reason: 'primary_missing',
        },
      ],
    ]);
    const [ended] = authorityTransitions(preceding, [
      slice('C', 16, 'primary', true),
    ]);
    expect(ended).toMatchObject({
      kind: 'ended',
      used: SUBSTITUTION.used,
      conflict: CONFLICT.detail,
    });
  });

  it('inside one period the role carries from slice to slice; slices without data change nothing', () => {
    const transitions = authorityTransitions(new Map(), [
      slice('3', 4, 'primary'),
      slice('1', 0, 'fallback'),
      slice('2', 2, 'none'),
    ]);
    expect(transitions.map((t) => [t.kind, t.sliceId])).toEqual([
      ['activated', '1'],
      ['ended', '3'],
    ]);
    expect(
      authorityTransitions(new Map([['P1', PRIMARY]]), [
        slice('A', 0, 'primary'),
      ]),
    ).toEqual([]);
  });

  it('a rerun with the same outcome publishes nothing; a changed outcome only the difference', () => {
    const preceding = new Map([['P1', PRIMARY]]);
    const first = authorityTransitions(preceding, [slice('B', 8, 'fallback')]);
    expect(newTransitions(first, first)).toEqual([]);
    const corrected = authorityTransitions(preceding, [
      slice('B', 8, 'primary'),
    ]);
    // late primary data: the rerun no longer uses the substitute, so the banner ends
    expect(newTransitions(corrected, first)).toEqual([
      { ...first[0], kind: 'ended', conflict: null },
    ]);
    expect(newTransitions(first, corrected)).toEqual(first);
  });
});

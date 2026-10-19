import { ExportLabels } from './export-labels';
import {
  kindLabel,
  lineSourceLabel,
  plantIso,
  reasonText,
  stateLabel,
} from './export-words';

const LABELS: ExportLabels = {
  requestedByName: 'Sara',
  plantTimezone: 'Asia/Tehran',
  reasonCodes: { 'rc-1': { code: 'MECH-GEARBOX', name: 'Gearbox failure' } },
};

describe('export words (QA audit 2026-10-19)', () => {
  it('labels stored keys in plain words, the residual as Unaccounted, unknown keys humanized', () => {
    expect(stateLabel('accepted')).toBe('Accepted');
    expect(stateLabel('in_force')).toBe('In force');
    expect(kindLabel('quality')).toBe('Quality');
    expect(kindLabel('residual')).toBe('Unaccounted');
    expect(kindLabel('unaccounted_classified')).toBe('Unaccounted');
    expect(kindLabel('some_new_kind')).toBe('Some new kind');
    expect(lineSourceLabel('candidate')).toBe('Calculated');
    expect(kindLabel(null)).toBeNull();
  });

  it('QA re-test N9: a stop-caused line without a reason code reads "Not coded"', () => {
    expect(
      reasonText(LABELS, { reasonCodeId: null, causeEventId: 'event-1' }),
    ).toBe('Not coded');
    expect(
      reasonText(LABELS, { reasonCodeId: 'rc-1', causeEventId: 'event-1' }),
    ).toBe('MECH-GEARBOX · Gearbox failure');
    expect(reasonText(LABELS, { reasonCodeId: null })).toBeNull();
  });

  it('reason text: pinned code and name, the comment of a manual line, or both', () => {
    expect(reasonText(LABELS, { reasonCodeId: 'rc-1' })).toBe(
      'MECH-GEARBOX · Gearbox failure',
    );
    expect(
      reasonText(LABELS, { reasonCodeId: null, reason: 'speed loss' }),
    ).toBe('speed loss');
    expect(
      reasonText(LABELS, { reasonCodeId: 'rc-1', reason: 'lab recount' }),
    ).toBe('MECH-GEARBOX · Gearbox failure — lab recount');
    expect(reasonText(null, { reasonCodeId: 'rc-1' })).toBeNull();
  });

  it('plant time as ISO 8601 with the plant offset; null without a zone', () => {
    expect(plantIso('2026-10-17T02:30:00.000Z', 'Asia/Tehran')).toBe(
      '2026-10-17T06:00:00+03:30',
    );
    expect(plantIso('2026-10-17T02:30:00.000Z', 'UTC')).toBe(
      '2026-10-17T02:30:00+00:00',
    );
    expect(plantIso('2026-10-17T02:30:00.000Z', null)).toBeNull();
  });
});

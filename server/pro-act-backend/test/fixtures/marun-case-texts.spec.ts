import {
  LEFTOVER_WORDING,
  plainCaseText,
  rowChanges,
} from '../../scripts/marun-train/case-text-plan';

/** QA re-test round 3: the closed investigation's typed texts lose only the course wording. */
describe('marun-train closed case texts', () => {
  it('removes the course wording and keeps the facts', () => {
    expect(plainCaseText('Training extruder stopped on a gearbox trip')).toBe(
      'Extruder stopped on a gearbox trip',
    );
    expect(plainCaseText('Oil analysis shows iron wear (fictional).')).toBe(
      'Oil analysis shows iron wear.',
    );
    expect(
      plainCaseText(
        '720 run-hour policy minimum (guide: 600 comparable hours)',
      ),
    ).toBe('720 run-hour policy minimum');
    expect(plainCaseText('{"note":"the training extruder (fictional)"}')).toBe(
      '{"note":"the extruder"}',
    );
    expect(
      plainCaseText(
        'Fictional training evidence. EXT1-State changes RUN to STOP',
      ),
    ).toBe('EXT1-State changes RUN to STOP');
    expect(plainCaseText('"tags":["gearbox","training"]')).toBe(
      '"tags":["gearbox"]',
    );
  });

  it('plans changes only for cells with course wording, so a second run changes nothing', () => {
    const changes = rowChanges('rcas', 'c1', {
      title: 'Gearbox trip',
      description: 'Training extruder stopped',
      notes: null,
    });
    expect(changes).toEqual([
      {
        table: 'rcas',
        column: 'description',
        id: 'c1',
        before: 'Training extruder stopped',
        after: 'Extruder stopped',
      },
    ]);
    expect(rowChanges('rcas', 'c1', { description: changes[0].after })).toEqual(
      [],
    );
  });

  it('flags wording the rules do not cover for review', () => {
    expect(LEFTOVER_WORDING.test('a fictional lab result')).toBe(true);
    expect(LEFTOVER_WORDING.test('Extruder stopped')).toBe(false);
  });
});

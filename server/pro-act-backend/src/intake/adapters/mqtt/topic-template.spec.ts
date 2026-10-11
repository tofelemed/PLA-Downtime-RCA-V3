import {
  compileTopicTemplate,
  equipmentOf,
  matchTopicTemplate,
  TopicTemplate,
} from './topic-template';

const TEMPLATE = 'proact/v1/{site}/{area}/{line}/{unit}/events';

function compiled(
  template = TEMPLATE,
  kind?: Parameters<typeof compileTopicTemplate>[1],
): TopicTemplate {
  const result = compileTopicTemplate(template, kind);
  if (typeof result === 'string') throw new Error(result);
  return result;
}

describe('topic templates (design §4.2 stage 2, contract §2)', () => {
  it('captures every {level} of a matching topic', () => {
    const match = matchTopicTemplate(
      compiled(),
      'proact/v1/HDPE/Polymer/Line1/Extruder1/events',
    );
    expect(match).toEqual({
      ok: true,
      captures: {
        site: 'HDPE',
        area: 'Polymer',
        line: 'Line1',
        unit: 'Extruder1',
      },
    });
  });

  it.each([
    ['fewer levels', 'proact/v1/HDPE/Polymer/Line1/events', 'levels'],
    [
      'more levels',
      'proact/v1/HDPE/Polymer/Line1/Extruder1/x/events',
      'levels',
    ],
    [
      'another literal',
      'proact/v1/HDPE/Polymer/Line1/Extruder1/state',
      'expects "events"',
    ],
    [
      'a literal in another case',
      'PROACT/v1/HDPE/Polymer/Line1/Extruder1/events',
      'expects "proact"',
    ],
    [
      'an empty capture level',
      'proact/v1//Polymer/Line1/Extruder1/events',
      'is empty',
    ],
  ])('refuses %s as TOPIC_SHAPE', (_label, topic, fragment) => {
    const match = matchTopicTemplate(compiled(), topic);
    expect(match.ok).toBe(false);
    if (!match.ok) {
      expect(match.code).toBe('TOPIC_SHAPE');
      expect(match.detail).toContain(fragment);
    }
  });

  it('matches a template without captures literally', () => {
    const literal = compiled('ot/gateway/availability', 'availability');
    expect(matchTopicTemplate(literal, 'ot/gateway/availability')).toEqual({
      ok: true,
      captures: {},
    });
    expect(matchTopicTemplate(literal, 'ot/gateway/other').ok).toBe(false);
  });

  it('requires the equipment capture of event and state profiles', () => {
    expect(
      compileTopicTemplate('ot/{site}/events', 'interval_event_json'),
    ).toContain('{machine} or {unit}');
    expect(
      compileTopicTemplate('ot/{site}/{machine}/state', 'state_json'),
    ).toMatchObject({
      captures: ['site', 'machine'],
    });
  });

  it('requires {attribute} as well for measurement templates', () => {
    expect(
      compileTopicTemplate('ot/{unit}/measurements', 'measurement_json'),
    ).toContain('{attribute}');
    expect(
      compileTopicTemplate(
        'ot/{unit}/measurements/{attribute}',
        'measurement_json',
      ),
    ).toMatchObject({ captures: ['unit', 'attribute'] });
  });

  it('reports template syntax problems from the step-1 parser', () => {
    expect(compileTopicTemplate('ot/+/{unit}')).toContain(
      'literal or a {capture}',
    );
    expect(compileTopicTemplate('ot/{unit}/{unit}')).toContain(
      'more than once',
    );
    expect(compileTopicTemplate('')).toContain('non-empty');
  });

  it('picks the equipment level: unit before machine, null when neither is captured', () => {
    expect(equipmentOf({ unit: 'U1', machine: 'M1' })).toBe('U1');
    expect(equipmentOf({ machine: 'M1' })).toBe('M1');
    expect(equipmentOf({ site: 'S' })).toBeNull();
  });
});

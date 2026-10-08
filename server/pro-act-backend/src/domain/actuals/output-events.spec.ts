import { outputEvents } from './output-events';
import { quantifySignal } from './signal-quantity';

const T0 = Date.UTC(2026, 9, 7, 8, 0, 0);
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const window = { from: at(0), to: at(60) };

describe('outputEvents (plan 1.7, PI09, D05)', () => {
  it('counts each source identity once (latest revision), in [from, to), good = gross − rejects', () => {
    const result = outputEvents(
      [
        {
          identity: 'EF-1',
          revision: 1,
          at: at(10),
          quantity: '10',
          rejects: '1',
        },
        {
          identity: 'EF-1',
          revision: 2,
          at: at(10),
          quantity: '12',
          rejects: '2',
        },
        { identity: 'EF-1', revision: 1, at: at(10), quantity: '99' },
        { identity: 'EF-2', at: at(59), quantity: '5.5' },
        { identity: 'EF-3', at: at(60), quantity: '100' },
        { identity: 'EF-4', at: at(30), quantity: '7', retracted: true },
      ],
      window,
    );

    expect(result).toMatchObject({
      quantity: '17.5',
      rejects: '2',
      good: '15.5',
      counted: 2,
      superseded: 2,
      exceptions: [],
    });
  });

  it('reports spanning and negative records; spanning ones count by booking time', () => {
    const result = outputEvents(
      [
        { identity: 'EF-5', start: at(-30), at: at(20), quantity: '4' },
        { identity: 'EF-6', at: at(25), quantity: '-3' },
      ],
      window,
    );

    expect(result.quantity).toBe('4');
    expect(result.exceptions.map((e) => e.code)).toEqual([
      'spanning_event',
      'negative_output',
    ]);
  });

  it('an empty window books nothing (null, not zero)', () => {
    expect(outputEvents([], window)).toMatchObject({
      quantity: null,
      good: null,
      counted: 0,
    });
  });

  it('output_increment signals sum their usable samples; bad ones are reported', () => {
    const quantity = quantifySignal(
      [
        { at: at(1), value: '2', quality: 'good' },
        { at: at(2), value: '3', quality: 'bad' },
        { at: at(3), value: '4', quality: 'good' },
      ],
      {
        semanticType: 'output_increment',
        interpolation: 'step',
        maxGapSeconds: 60,
      },
      window,
    );

    expect(quantity.engine).toBe('output_events');
    expect(quantity).toMatchObject({
      result: { quantity: '6', exceptions: [{ code: 'bad_quality' }] },
    });
  });

  it('other semantic types carry no quantity', () => {
    expect(
      quantifySignal(
        [],
        { semanticType: 'level', interpolation: 'step', maxGapSeconds: 60 },
        window,
      ),
    ).toMatchObject({
      engine: 'none',
      exceptions: [{ code: 'wrong_semantic_type' }],
    });
  });
});

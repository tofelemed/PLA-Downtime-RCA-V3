import { DerivedStop } from './derived-stops';
import {
  describeStop,
  EngineOwnedEvent,
  planDerivedWrites,
} from './derived-stop-writes';

const T0 = Date.UTC(2026, 9, 15, 10);
const t = (s: number) => new Date(T0 + s * 1000);

const stop = (
  startS: number,
  endS: number | null,
  extra: Partial<DerivedStop> = {},
): DerivedStop => ({
  key: `internal_stop@${T0 + startS * 1000}`,
  occurrenceKey: `internal_stop@${T0 + startS * 1000}`,
  state: 'internal_stop',
  scheduleClass: 'unplanned',
  start: t(startS),
  end: endS === null ? null : t(endS),
  startAfterUnknown: false,
  endBeforeUnknown: false,
  ...extra,
});

const owned = (
  s: DerivedStop,
  extra: Partial<EngineOwnedEvent> = {},
): EngineOwnedEvent => ({
  id: `e-${s.key}`,
  key: s.key,
  live: true,
  end: s.end,
  occurrenceId: `e-${s.key}`,
  description: describeStop(s),
  ...extra,
});

const ids = () => {
  let n = 0;
  return () => `new-${(n += 1)}`;
};

describe('derived stop writes (plan 1.10 idempotent reprocessing)', () => {
  it('first run creates one event per stop; its occurrence is its own id', () => {
    const plan = planDerivedWrites([], [stop(0, 90)], ids());
    expect(plan.create.map((c) => [c.id, c.occurrenceId])).toEqual([
      ['new-1', 'new-1'],
    ]);
    expect(plan.update).toEqual([]);
    expect(plan.retract).toEqual([]);
  });

  it('reprocessing the same timeline writes nothing', () => {
    const s = stop(0, 90);
    expect(planDerivedWrites([owned(s)], [s], ids())).toEqual({
      create: [],
      update: [],
      retract: [],
    });
  });

  it('an open stop that closed is updated in place', () => {
    const open = stop(0, null);
    const plan = planDerivedWrites([owned(open)], [stop(0, 90)], ids());
    expect(plan.update.map((u) => [u.id, u.stop.end])).toEqual([
      [`e-${open.key}`, t(90)],
    ]);
  });

  it('a late sample that moves the start retracts the old key and creates the new one', () => {
    const old = stop(0, 90);
    const plan = planDerivedWrites([owned(old)], [stop(20, 90)], ids());
    expect(plan.retract).toEqual([`e-${old.key}`]);
    expect(plan.create).toHaveLength(1);
  });

  it('a key a person split, merged or retracted is never written again', () => {
    const s = stop(0, 90);
    const plan = planDerivedWrites(
      [owned(s, { live: false })],
      [stop(0, 120)],
      ids(),
    );
    expect(plan).toEqual({ create: [], update: [], retract: [] });
  });

  it('a stop resuming after unknown time joins the occurrence of the stop already written', () => {
    const first = stop(0, 60, { endBeforeUnknown: true });
    const second = stop(300, 400, {
      occurrenceKey: first.occurrenceKey,
      startAfterUnknown: true,
    });
    const plan = planDerivedWrites([owned(first)], [first, second], ids());
    expect(plan.create.map((c) => c.occurrenceId)).toEqual([`e-${first.key}`]);
    expect(describeStop(second)).toContain('start after unknown signal time');
  });
});

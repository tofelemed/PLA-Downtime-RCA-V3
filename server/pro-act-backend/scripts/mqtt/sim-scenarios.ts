/**
 * Scenario registry of the publisher simulator (`publish-sim.ts`): the measurement, state and
 * availability scenarios live here, the event-frame scenarios in `sim-event-scenarios.ts`. Each
 * scenario publishes a short, documented sequence of contract v1 messages and logs what Pro-Act
 * should make of it.
 */
import { burst, duplicates, openClose, poison } from './sim-event-scenarios';
import {
  availabilityMessage,
  measurementDigital,
  measurementNumeric,
  nowIso,
  stateMessage,
} from './sim-messages';
import {
  numberFlag,
  publish,
  Scenario,
  sleep,
  stringFlagOr,
} from './sim-scenario-support';

const measurements: Scenario = {
  name: 'measurements',
  usage:
    '[--signal F1DPwebid-throughput] [--digital-signal F1DPwebid-runstate] [--every 2] [--count 10] numeric + digital samples',
  async run(ctx) {
    const signal = stringFlagOr(ctx.flags, 'signal', 'F1DPwebid-throughput');
    const digitalSignal = stringFlagOr(
      ctx.flags,
      'digital-signal',
      'F1DPwebid-runstate',
    );
    const everyMs = numberFlag(ctx.flags, 'every', 2) * 1000;
    const count = numberFlag(ctx.flags, 'count', 10);
    for (let index = 0; index < count; index += 1) {
      const value = 1500 + (index % 7) * 3.5;
      const numeric = measurementNumeric(ctx.ids, signal, value, 't', nowIso());
      const throughput = ctx.topics.measurement('Throughput');
      await publish(
        ctx,
        throughput,
        numeric,
        `signal=${signal} value=${value} t`,
      );
      const run = index % 4 !== 3;
      const state = run
        ? { name: 'RUN', value: 1 }
        : { name: 'STOP', value: 0 };
      const digital = measurementDigital(
        ctx.ids,
        digitalSignal,
        state,
        nowIso(),
      );
      const runState = ctx.topics.measurement('RunState');
      await publish(
        ctx,
        runState,
        digital,
        `signal=${digitalSignal} ${state.name}`,
      );
      if (index + 1 < count) await sleep(everyMs);
    }
  },
};

const state: Scenario = {
  name: 'state',
  usage:
    '[--sequence RUN,STOP,RUN] [--every 2] retained run states with previous',
  async run(ctx) {
    const sequence = stringFlagOr(ctx.flags, 'sequence', 'RUN,STOP,RUN')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const everyMs = numberFlag(ctx.flags, 'every', 2) * 1000;
    let previous: string | null = null;
    for (const [index, name] of sequence.entries()) {
      const message = stateMessage(ctx.ids, name, previous, nowIso());
      await publish(
        ctx,
        ctx.topics.state,
        message,
        `state=${name} previous=${previous ?? '-'} (parked no_handler until 1.10)`,
        true,
      );
      previous = name;
      if (index + 1 < sequence.length) await sleep(everyMs);
    }
  },
};

const availability: Scenario = {
  name: 'availability',
  usage:
    '[--hold 10] [--crash] retained ONLINE, OFFLINE on clean shutdown; --crash exits without DISCONNECT so the Last Will fires',
  async run(ctx) {
    const holdMs = numberFlag(ctx.flags, 'hold', 10) * 1000;
    const topic = ctx.topics.availability;
    const online = availabilityMessage(ctx.ids, 'ONLINE', nowIso());
    await publish(ctx, topic, online, 'sourceAvailable=true', true);
    ctx.logger.log(
      `holding ${holdMs / 1000} s (the Last Will OFFLINE is registered on this topic)`,
    );
    await sleep(holdMs);
    if (ctx.flags.crash === true) {
      ctx.logger.log(
        'crash: socket destroyed without DISCONNECT; the broker publishes the Last Will',
      );
      ctx.client.end(true);
      return;
    }
    const offline = availabilityMessage(ctx.ids, 'OFFLINE', nowIso());
    await publish(
      ctx,
      topic,
      offline,
      'clean shutdown: sourceAvailable=false',
      true,
    );
  },
};

const clear: Scenario = {
  name: 'clear',
  usage:
    'removes the retained messages this simulator leaves on the state, availability and events topics',
  async run(ctx) {
    const topics = [
      ctx.topics.state,
      ctx.topics.availability,
      ctx.topics.events,
    ];
    for (const topic of topics) {
      await ctx.client.publishAsync(topic, '', { qos: 1, retain: true });
      ctx.logger.log(`cleared the retained message on ${topic}`);
    }
  },
};

export const SCENARIOS: readonly Scenario[] = [
  openClose,
  burst,
  measurements,
  state,
  availability,
  duplicates,
  poison,
  clear,
];

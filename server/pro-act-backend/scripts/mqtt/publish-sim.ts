/**
 * MQTT publisher simulator (plan 1.8 WP3 step 4): plays the OT gateway of docs/MQTT_OT_CONTRACT.md against
 * a broker so the subscriber host, the quarantine and the R1–R16 checks can be exercised without PI.
 *
 *   npm run mqtt:sim -- <scenario> [--url mqtt://localhost:1884] [--username proact-sim] [--ca <pem file>]
 *       [--insecure] [--protocol 5|4] [--namespace proact/v1] [--site HDPE --area Polymer --line Line1
 *       --unit Extruder1] [--source gw-sim-01] [--seed <text>] [--contract-attribute-names] [scenario flags]
 *
 *   Scenarios (flags in `sim-scenarios.ts`): open-close, burst, measurements, state, availability,
 *   duplicates, poison, clear. `npm run mqtt:sim` without a scenario prints them.
 *
 * The broker password comes from the env `MQTT_SIM_PASSWORD` (never a flag, never logged). `--ca` trusts a
 * CA PEM for mqtts:// URLs (the Compose broker: docker/mosquitto/certs/dev-ca.crt); `--insecure` disables
 * certificate verification (lab only). `--seed` makes boot_id and event ids reproducible, so a re-run with
 * the same seed is a set of duplicates to Pro-Act; without it every run is a new publisher boot.
 * The client id is `sim-<random>`: never a `proact-…` id, which would evict the live subscriber.
 */
import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as mqtt from 'mqtt';
import {
  parseCliArgs,
  stringFlag,
} from '../../src/migration-cutover/cli/cli-args';
import {
  AttributeNames,
  availabilityWill,
  Equipment,
  SimIdentity,
  topicsOf,
} from './sim-messages';
import { Flags, Scenario } from './sim-scenario-support';
import { SCENARIOS } from './sim-scenarios';

const logger = new Logger('MqttSim');

interface SimOptions {
  url: string;
  username: string | null;
  password: string | null;
  caPem: string | null;
  insecure: boolean;
  protocolVersion: 4 | 5;
  namespace: string;
  equipment: Equipment;
  source: string;
  seed: string | null;
  attributeNames: AttributeNames;
}

function usage(): string {
  const lines = SCENARIOS.map(
    (scenario) => `  ${scenario.name.padEnd(14)} ${scenario.usage}`,
  );
  return `usage: npm run mqtt:sim -- <scenario> [options]\nscenarios:\n${lines.join('\n')}`;
}

function parseOptions(flags: Flags): SimOptions {
  const url =
    stringFlag({ command: null, flags }, 'url') ?? 'mqtt://localhost:1884';
  const protocol = flags.protocol;
  if (protocol !== undefined && protocol !== '5' && protocol !== '4') {
    throw new Error('--protocol must be 5 or 4');
  }
  const caPath = typeof flags.ca === 'string' ? flags.ca : null;
  const text = (key: string, fallback: string) =>
    typeof flags[key] === 'string' ? flags[key] : fallback;
  return {
    url,
    username: typeof flags.username === 'string' ? flags.username : null,
    password: process.env.MQTT_SIM_PASSWORD ?? null,
    caPem: caPath ? readFileSync(caPath, 'utf8') : null,
    insecure: flags.insecure === true,
    protocolVersion: protocol === '4' ? 4 : 5,
    namespace: text('namespace', 'proact/v1'),
    equipment: {
      site: text('site', 'HDPE'),
      area: text('area', 'Polymer'),
      line: text('line', 'Line1'),
      unit: text('unit', 'Extruder1'),
    },
    source: text('source', 'gw-sim-01'),
    seed: typeof flags.seed === 'string' ? flags.seed : null,
    attributeNames:
      flags['contract-attribute-names'] === true ? 'contract' : 'catalog',
  };
}

function clientOptions(
  options: SimOptions,
  will: mqtt.IClientOptions['will'],
): mqtt.IClientOptions {
  const clientOpts: mqtt.IClientOptions = {
    clientId: `sim-${Math.random().toString(36).slice(2, 10)}`,
    protocolVersion: options.protocolVersion,
    clean: true,
    keepalive: 30,
    connectTimeout: 10_000,
    reconnectPeriod: 0,
    manualConnect: true,
    will,
  };
  if (options.username !== null) clientOpts.username = options.username;
  if (options.password !== null) clientOpts.password = options.password;
  if (options.url.startsWith('mqtts://')) {
    clientOpts.rejectUnauthorized = !options.insecure;
    if (options.caPem) clientOpts.ca = [options.caPem];
    if (!options.caPem && !options.insecure) {
      logger.warn(
        'mqtts:// without --ca: the system trust store must know the broker certificate',
      );
    }
  }
  return clientOpts;
}

function connect(
  options: SimOptions,
  will: mqtt.IClientOptions['will'],
): Promise<mqtt.MqttClient> {
  const client = mqtt.connect(options.url, clientOptions(options, will));
  return new Promise((resolve, reject) => {
    client.once('connect', (connack) => {
      logger.log(
        `connected to ${options.url} as ${client.options.clientId ?? '?'} (MQTT ${options.protocolVersion === 5 ? '5' : '3.1.1'}, user ${options.username ?? 'anonymous'}, sessionPresent=${String(connack.sessionPresent)})`,
      );
      resolve(client);
    });
    client.once('error', (error) => {
      client.end(true);
      reject(error);
    });
    client.connect();
  });
}

function endCleanly(client: mqtt.MqttClient): Promise<void> {
  return new Promise((resolve) => {
    client.end(false, {}, () => resolve());
  });
}

function findScenario(name: string | null): Scenario {
  const scenario = SCENARIOS.find((candidate) => candidate.name === name);
  if (!scenario) {
    throw new Error(`unknown scenario "${name ?? ''}"\n${usage()}`);
  }
  return scenario;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.command === null || args.flags.help === true) {
    logger.log(usage());
    return;
  }
  const scenario = findScenario(args.command);
  const options = parseOptions(args.flags);
  // the scenario name is part of the seed so two scenarios run with one seed do not share event ids
  const ids = new SimIdentity(
    options.seed === null ? null : `${options.seed}:${scenario.name}`,
    options.source,
  );
  const topics = topicsOf(options.namespace, options.equipment);
  const will: mqtt.IClientOptions['will'] =
    scenario.name === 'availability'
      ? {
          topic: topics.availability,
          payload: Buffer.from(JSON.stringify(availabilityWill(ids))),
          qos: 1,
          retain: true,
        }
      : undefined;
  const client = await connect(options, will);
  logger.log(
    `scenario ${scenario.name}: boot_id=${ids.bootId} events=${topics.events}${options.seed ? ` seed=${options.seed}` : ''}`,
  );
  try {
    await scenario.run({
      client,
      ids,
      topics,
      equipment: options.equipment,
      attributeNames: options.attributeNames,
      flags: args.flags,
      logger,
    });
  } finally {
    if (!client.disconnecting && client.connected) await endCleanly(client);
  }
  logger.log(`scenario ${scenario.name} done (last seq ${ids.lastSeq})`);
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

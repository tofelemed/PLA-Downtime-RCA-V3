/**
 * `--verify`: logs every persona user in through the live API, runs the persona's probes with the
 * acting tenant in `X-Tenant-Id` and prints a persona → users → effective roles table.
 *
 * No endpoint exposes the roles a request context resolves (GET /api/auth/profile returns the legacy
 * role only), so the effective roles are derived the way `RequestContextFactory` derives them and each
 * row is confirmed by an allowed write (guards passed: 2xx, or a 4xx validation answer with no data
 * written) and a forbidden one (403 FORBIDDEN_ROLE / READ_ONLY_ROLE / TENANT_NOT_ALLOWED).
 */
import { rolesForLegacyRole } from '../../src/auth/roles/role-model';
import { DemoWorld } from './demo-world';
import { PersonaApiClient, ProbeResponse } from './persona-api';
import {
  DEMO_PERSONA_PASSWORD,
  Persona,
  PersonaUser,
  PlantKey,
  Probe,
} from './persona-catalog';

/** Valid uuid that no tenant has: SuperAdmin may select any tenant that exists, not this one. */
const UNKNOWN_TENANT_ID = '00000000-0000-4000-8000-00000000dead';

export interface VerifyInput {
  apiUrl: string;
  world: DemoWorld;
  personas: readonly Persona[];
  /** current value of the probed flag per plant, so `PUT flag` changes nothing */
  flagValues: Record<PlantKey, boolean>;
}

export interface VerifyRow {
  persona: string;
  email: string;
  home: string;
  acting: string;
  roles: string[];
  probes: string[];
  ok: boolean;
}

/** Mirrors RequestContextFactory: legacy role in the home tenant (SuperAdmin everywhere, OrgAdmin in its org) + scopes. */
export function effectiveRoles(
  world: DemoWorld,
  user: PersonaUser,
  acting: PlantKey,
): string[] {
  const home = world.plants[user.homePlant];
  const target = world.plants[acting];
  const legacyApplies =
    acting === user.homePlant ||
    user.legacyRole === 'SuperAdmin' ||
    (user.legacyRole === 'OrgAdmin' &&
      home.organizationId === target.organizationId);
  const scoped = user.scopes
    .filter((scope) => scope.plant === acting)
    .map((scope) => scope.role);
  return [
    ...new Set([
      ...(legacyApplies ? rolesForLegacyRole(user.legacyRole) : []),
      ...scoped,
    ]),
  ];
}

function probeMatches(probe: Probe, response: ProbeResponse): boolean {
  if (probe.expect === 'allowed') {
    return response.status !== 401 && response.status !== 403;
  }
  return response.status === 403 && response.code === probe.expect;
}

function probeBody(probe: Probe, input: VerifyInput): unknown {
  if (probe.body === 'empty') return {};
  if (probe.body === 'flag' && probe.plant !== 'unknown') {
    return { enabled: input.flagValues[probe.plant] };
  }
  return undefined;
}

async function runProbe(
  client: PersonaApiClient,
  token: string,
  probe: Probe,
  input: VerifyInput,
): Promise<{ text: string; ok: boolean }> {
  const tenantId =
    probe.plant === 'unknown'
      ? UNKNOWN_TENANT_ID
      : input.world.plants[probe.plant].id;
  const response = await client.probe(token, {
    method: probe.method,
    path: probe.path,
    tenantId,
    body: probeBody(probe, input),
  });
  const ok = probeMatches(probe, response);
  const outcome = response.code
    ? `${response.status} ${response.code}`
    : `${response.status}`;
  return {
    text: `${probe.label} -> ${outcome} (${ok ? 'ok' : `FAIL, expected ${probe.expect}`})`,
    ok,
  };
}

async function verifyUser(
  client: PersonaApiClient,
  persona: Persona,
  user: PersonaUser,
  input: VerifyInput,
): Promise<VerifyRow> {
  const base = {
    persona: persona.label,
    email: user.email,
    home: input.world.plants[user.homePlant].name,
    acting: input.world.plants[persona.actingPlant].name,
    roles: effectiveRoles(input.world, user, persona.actingPlant),
  };
  let login: Awaited<ReturnType<PersonaApiClient['login']>>;
  try {
    login = await client.login(user.email, DEMO_PERSONA_PASSWORD);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, probes: [`login FAIL: ${message}`], ok: false };
  }
  const probes: string[] = [];
  let ok = login.homeTenantId === input.world.plants[user.homePlant].id;
  if (!ok)
    probes.push(`login FAIL: home tenant ${login.homeTenantId ?? 'none'}`);
  for (const probe of [...persona.probes, ...user.probes]) {
    const result = await runProbe(client, login.token, probe, input);
    probes.push(result.text);
    ok = ok && result.ok;
  }
  return { ...base, probes, ok };
}

export async function verifyPersonas(input: VerifyInput): Promise<VerifyRow[]> {
  const client = new PersonaApiClient(input.apiUrl);
  const rows: VerifyRow[] = [];
  for (const persona of input.personas) {
    for (const user of persona.users) {
      rows.push(await verifyUser(client, persona, user, input));
    }
  }
  return rows;
}

function pad(value: string, width: number): string {
  return value.padEnd(width);
}

/** Plain-text table (one line per user) for the terminal and the report. */
export function formatVerifyTable(rows: readonly VerifyRow[]): string {
  const headers = [
    'Persona',
    'User',
    'Home plant',
    'Acting plant',
    'Effective roles',
    'Result',
    'Probes',
  ];
  const cells = rows.map((row) => [
    row.persona,
    row.email,
    row.home,
    row.acting,
    row.roles.join(', '),
    row.ok ? 'OK' : 'FAIL',
    row.probes.join('; '),
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...cells.map((cell) => cell[index].length)),
  );
  const line = (cell: string[]) =>
    `| ${cell.map((value, index) => pad(value, widths[index])).join(' | ')} |`;
  const divider = `|${widths.map((width) => '-'.repeat(width + 2)).join('|')}|`;
  return [line(headers), divider, ...cells.map(line)].join('\n');
}

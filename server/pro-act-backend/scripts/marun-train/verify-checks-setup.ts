/**
 * Read-only checks of the plant model against the guide: plant settings, people and roles, master data,
 * codes, calendar and crews, profiles with approved sustained and planning rates.
 */
import {
  ASSET,
  CREWS,
  emailOf,
  PEOPLE,
  PLANT,
  PRODUCTS,
  TIMES,
} from './train-catalog';
import { DICTIONARY, RCA_CAUSES, REASONS } from './train-catalog-codes';
import { TrainContext } from './train-context';
import { Check, check, Refs } from './verify-support';

interface Row {
  id: string;
  code: string;
}

export async function checkPlant(ctx: TrainContext): Promise<Check[]> {
  const plant = await ctx.admin().get<{
    id: string;
    timezone: string | null;
    calendarSystem: string;
    digits: string;
    weekStart: string;
  }>(`/v2/tenants/${ctx.tenantId}`);
  const ok =
    plant.timezone === PLANT.timezone &&
    plant.calendarSystem === PLANT.calendarSystem &&
    plant.digits === PLANT.digits &&
    plant.weekStart === PLANT.weekStart;
  const detail = `${plant.timezone ?? 'no zone'}, ${plant.calendarSystem}, ${plant.digits} digits, week from ${plant.weekStart}`;
  return [check('plant settings', ok, detail, [plant.id])];
}

export async function checkPeople(
  refs: Refs,
  tenantId: string,
): Promise<Check[]> {
  const missing: string[] = [];
  const ids: string[] = [];
  for (const spec of PEOPLE) {
    const query = new URLSearchParams({ email: emailOf(spec.key) });
    const user = await refs.reader.call<{ id: string }>(
      'GET',
      `/v2/users/lookup?${query}`,
      undefined,
      { accept: [404] },
    );
    if (user.status === 404) {
      missing.push(spec.key);
      continue;
    }
    ids.push(user.body.id);
    const scopes = await refs.reader.listAll<{ role: string; scopeId: string }>(
      '/v2/user-scopes',
      { userId: user.body.id },
    );
    const lacking = spec.roles.filter(
      (role) => !scopes.some((s) => s.role === role && s.scopeId === tenantId),
    );
    if (lacking.length) missing.push(`${spec.key} (${lacking.join(', ')})`);
  }
  const detail = missing.length
    ? `missing: ${missing.join('; ')}`
    : `${PEOPLE.length} people with their plant roles`;
  return [check('people and roles', missing.length === 0, detail, ids)];
}

export async function checkMasterData(refs: Refs): Promise<Check[]> {
  const assets = await refs.reader.listAll<Row & { unitId: string }>(
    '/v2/assets',
  );
  const asset = assets.find(
    (a) => a.code === ASSET.code && a.unitId === refs.unitId,
  );
  const products = await refs.reader.listAll<Row & { availability: string }>(
    '/v2/products',
  );
  const ours = products.filter(
    (p) =>
      PRODUCTS.some((s) => s.code === p.code) && p.availability === 'plant',
  );
  return [
    check(
      'unit Extruder1',
      refs.unitId !== null,
      refs.unitId ? 'present' : 'missing',
      refs.unitId ? [refs.unitId] : [],
    ),
    check(
      'asset EXT1-Main',
      Boolean(asset),
      asset ? 'on Extruder1' : 'missing',
      asset ? [asset.id] : [],
    ),
    check(
      'plant-only products',
      ours.length === PRODUCTS.length,
      `${ours.length}/${PRODUCTS.length}`,
      ours.map((p) => p.id),
    ),
  ];
}

export async function checkCodes(refs: Refs): Promise<Check[]> {
  const reasons = await refs.reader.listAll<Row & { parentId: string | null }>(
    '/v2/reason-codes',
  );
  const byCode = new Map(reasons.map((r) => [r.code, r]));
  const present = REASONS.filter((r) => byCode.has(r.code));
  const gearbox = byCode.get('MECH-GEARBOX');
  const hierarchy = gearbox?.parentId === byCode.get('DRIVE-TRAIN')?.id;
  const entries = await refs.reader.listAll<{ code: string }>(
    '/v2/failure-dictionary',
  );
  const dictionary = DICTIONARY.filter((d) =>
    entries.some((e) => e.code === d.code),
  );
  const causes = await refs.reader.listAll<Row>('/v2/rca-causes');
  const catalogue = RCA_CAUSES.filter((c) =>
    causes.some((row) => row.code === c.code),
  );
  return [
    check(
      'reason codes',
      present.length === REASONS.length && hierarchy,
      `${present.length}/${REASONS.length}, gearbox under Drive train: ${hierarchy}`,
    ),
    check(
      'failure dictionary',
      dictionary.length === DICTIONARY.length,
      `${dictionary.length}/${DICTIONARY.length} entries`,
    ),
    check(
      'rca causes',
      catalogue.length === RCA_CAUSES.length,
      `${catalogue.length}/${RCA_CAUSES.length} 6M causes`,
    ),
  ];
}

export async function checkCalendar(refs: Refs): Promise<Check[]> {
  const versions = await refs.reader.listAll<{
    id: string;
    unitId: string | null;
    state: string;
    effectiveFrom: string;
    timezone: string;
    operationalDayStart: string;
  }>('/v2/calendar-versions');
  const published = versions.find(
    (v) =>
      v.unitId === null &&
      v.state === 'published' &&
      v.effectiveFrom.slice(0, 10) === TIMES.operationalDate,
  );
  const detail = published
    ? `${published.timezone}, day from ${published.operationalDayStart}`
    : 'no published default-site version';
  return [
    check(
      'calendar published',
      Boolean(published),
      detail,
      published ? [published.id] : [],
    ),
    await checkCrews(refs),
  ];
}

async function checkCrews(refs: Refs): Promise<Check> {
  const crews = await refs.reader.listAll<{ id: string; name: string }>(
    '/v2/crews',
  );
  const ours = crews.filter((c) => CREWS.some((s) => s.name === c.name));
  let rotations = 0;
  for (const crew of ours) {
    const rows = await refs.reader.listAll<{ id: string }>(
      '/v2/crew-rotations',
      { crewId: crew.id },
    );
    if (rows.length > 0) rotations += 1;
  }
  return check(
    'crews with rotations',
    rotations === CREWS.length,
    `${rotations}/${CREWS.length}`,
    ours.map((c) => c.id),
  );
}

export async function checkProfiles(refs: Refs): Promise<Check[]> {
  const checks: Check[] = [];
  for (const spec of PRODUCTS) {
    const profileId = refs.profiles.get(spec.code);
    if (!profileId) {
      checks.push(check(`profile ${spec.code}`, false, 'no approved profile'));
      continue;
    }
    const rates = await refs.reader.listAll<{
      id: string;
      rateKind: string;
      rate: string;
      state: string;
    }>(`/v2/profiles/${profileId}/rates`);
    const approved = (kind: string) =>
      rates.find((r) => r.rateKind === kind && r.state === 'approved');
    const sustained = approved('sustained');
    const planning = approved('planning');
    const ok =
      Number(sustained?.rate) === Number(spec.rate) &&
      Number(planning?.rate) === Number(spec.rate);
    const detail = `approved; sustained ${sustained?.rate ?? '—'} / planning ${planning?.rate ?? '—'} t/h (guide ${spec.rate})`;
    checks.push(check(`profile ${spec.code}`, ok, detail, [profileId]));
  }
  return checks;
}

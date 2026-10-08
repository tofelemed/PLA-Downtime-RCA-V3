import { randomUUID } from 'crypto';
import { signToken } from './support/test-app';
import { SitesService } from '../../src/calendar/sites.service';
import {
  ApiError,
  CalendarWorld,
  threeShiftCalendar,
} from './support/calendar-world';

interface VersionBody {
  id: string;
  siteId: string;
  unitId: string | null;
  version: number;
  state: string;
  timezone: string;
  operationalDayStart: string;
  rowVersion: number;
}

interface PublishBody {
  version: VersionBody;
  materialization: Array<{
    unitId: string;
    insertedInstances: number;
    deletedInstances: number;
    unchangedDates: number;
    hash: string;
  }>;
}

interface InstanceBody {
  id: string;
  unitId: string;
  shiftName: string;
  localDate: string;
  utcStart: string;
  durationSeconds: number;
  crewId: string | null;
}

/**
 * Plan 2.1 v2 API: calendar versions (draft → published, immutable), publication materializing shift
 * instances, idempotent regeneration, unit overrides, tenant isolation (foreign path ids 404, foreign
 * body ids 422 INVALID_REFERENCE), write roles and the shift-instance list.
 */
describe('calendar versions and shift instances (plan 2.1, v2 API)', () => {
  const env = new CalendarWorld();
  let draftId = '';
  let firstPublish: PublishBody;

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  it('needs a calendar writer role (403 for an analyst) and an Idempotency-Key (428)', async () => {
    const body = {
      ...threeShiftCalendar('Asia/Tehran'),
      effectiveFrom: await env.todayA(),
    };
    await env.post('calendar-versions', body, env.analyst).expect(403);
    await env
      .http()
      .post('/api/v2/calendar-versions')
      .set('Authorization', `Bearer ${env.admin}`)
      .send(body)
      .expect(428);
    await env.http().get('/api/v2/calendar-versions').expect(401);
  });

  it('refuses foreign site and unit ids (422 INVALID_REFERENCE) and definitions it would have to guess', async () => {
    const siteB = await env.app
      .get(SitesService)
      .defaultSite(env.world.tenantB);
    const base = {
      ...threeShiftCalendar('Asia/Tehran'),
      effectiveFrom: '2026-10-10',
    };
    const codeOf = async (body: object): Promise<string> =>
      ((await env.post('calendar-versions', body).expect(422)).body as ApiError)
        .code;
    expect(await codeOf({ ...base, siteId: siteB.id })).toBe(
      'INVALID_REFERENCE',
    );
    expect(await codeOf({ ...base, unitId: env.world.unitB1 })).toBe(
      'INVALID_REFERENCE',
    );
    expect(await codeOf({ ...base, timezone: 'Mars/Olympus' })).toBe(
      'INVALID_TIMEZONE',
    );
    const overlapping = {
      ...base,
      shiftTemplates: [
        { name: 'A', startLocal: '06:00', endLocal: '14:00' },
        { name: 'B', startLocal: '13:00', endLocal: '21:00' },
      ],
    };
    expect(await codeOf(overlapping)).toBe('OVERLAPPING_SHIFTS');
    expect(await codeOf({ ...base, effectiveTo: '2026-10-01' })).toBe(
      'INVALID_EFFECTIVE_DATES',
    );
    expect(
      await codeOf({
        ...base,
        shiftTemplates: [{ name: 'A', startLocal: '6am', endLocal: '14:00' }],
      }),
    ).toBe('VALIDATION_FAILED');
  });

  it('creates a draft with the site defaults (tenant without a valid zone → UTC, flagged)', async () => {
    const { shiftTemplates } = threeShiftCalendar('UTC') as {
      shiftTemplates: object[];
    };
    const created = await env
      .post('calendar-versions', {
        shiftTemplates,
        effectiveFrom: await env.todayA(-2),
      })
      .expect(201);
    const body = created.body as VersionBody;
    expect(body).toMatchObject({
      state: 'draft',
      version: 1,
      timezone: 'UTC',
      operationalDayStart: '06:00',
      unitId: null,
    });
    expect(created.headers.etag).toBe(`"${body.rowVersion}"`);
    draftId = body.id;
    const sites = await env.get('sites').expect(200);
    expect(sites.body.items).toEqual([
      expect.objectContaining({
        id: body.siteId,
        timezone: 'UTC',
        timezoneFallback: true,
        isDefault: true,
      }),
    ]);
  });

  it('edits a draft with If-Match only (428 / 412), foreign callers get 404', async () => {
    const path = `calendar-versions/${draftId}`;
    await env
      .http()
      .patch(`/api/v2/${path}`)
      .set('Authorization', `Bearer ${env.admin}`)
      .send({})
      .expect(428);
    await env.patch(path, { operationalDayStart: '07:00' }, '"99"').expect(412);
    const etag = (await env.get(path).expect(200)).headers.etag as string;
    const patched = await env
      .patch(path, { operationalDayStart: '07:00' }, etag)
      .expect(200);
    expect((patched.body as VersionBody).operationalDayStart).toBe('07:00');
    const back = await env
      .patch(
        path,
        { operationalDayStart: '06:00' },
        patched.headers.etag as string,
      )
      .expect(200);
    expect((back.body as VersionBody).operationalDayStart).toBe('06:00');
    await env.get(path, env.adminB).expect(404);
    await env
      .patch(
        path,
        { operationalDayStart: '08:00' },
        back.headers.etag as string,
        env.adminB,
      )
      .expect(404);
    await env.post(`${path}/publish`, {}, env.adminB).expect(404);
    expect(
      (await env.get('calendar-versions', env.adminB).expect(200)).body.items,
    ).toEqual([]);
  });

  it('publishing generates the instances of every unit of the site up to today + 90 days', async () => {
    const response = await env
      .post(`calendar-versions/${draftId}/publish`, {})
      .expect(200);
    firstPublish = response.body as PublishBody;
    expect(firstPublish.version.state).toBe('published');
    expect(firstPublish.materialization.map((m) => m.unitId).sort()).toEqual(
      [env.world.unitA1, env.world.unitA2, env.world.unitA3].sort(),
    );
    const days = 2 + 1 + 90;
    expect(
      firstPublish.materialization.every(
        (m) => m.insertedInstances === days * 3,
      ),
    ).toBe(true);
    const [{ n }] = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM shift_instances WHERE unit_id = $1`,
      [env.world.unitA1],
    );
    expect(n).toBe(days * 3);
  });

  it('a published version is immutable: PATCH 409, second publish without reason 409, the database refuses edits', async () => {
    const path = `calendar-versions/${draftId}`;
    const etag = (await env.get(path).expect(200)).headers.etag as string;
    const patched = await env
      .patch(path, { operationalDayStart: '07:00' }, etag)
      .expect(409);
    expect((patched.body as ApiError).code).toBe('CALENDAR_VERSION_PUBLISHED');
    const again = await env.post(`${path}/publish`, {}).expect(409);
    expect((again.body as ApiError).code).toBe('ALREADY_PUBLISHED');
    await expect(
      env.rows(
        `UPDATE calendar_versions SET timezone = 'Asia/Dubai' WHERE id = $1`,
        [draftId],
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      env.rows(`DELETE FROM calendar_versions WHERE id = $1`, [draftId]),
    ).rejects.toThrow(/immutable/);
  });

  it('re-publishing with a reason regenerates idempotently: equal hashes, no row rewritten', async () => {
    const before = await env.rows<{ id: string }>(
      `SELECT id FROM shift_instances ORDER BY id`,
    );
    const response = await env
      .post(`calendar-versions/${draftId}/publish`, {
        reason: 'verify regeneration',
        regenerateFrom: await env.todayA(-2),
      })
      .expect(200);
    const body = response.body as PublishBody;
    expect(body.version.state).toBe('published');
    expect(
      body.materialization.every(
        (m) => m.insertedInstances === 0 && m.deletedInstances === 0,
      ),
    ).toBe(true);
    expect(body.materialization.map((m) => m.hash).sort()).toEqual(
      firstPublish.materialization.map((m) => m.hash).sort(),
    );
    expect(
      await env.rows(`SELECT id FROM shift_instances ORDER BY id`),
    ).toEqual(before);
    const [row] = await env.rows<{ republish_reason: string }>(
      `SELECT republish_reason FROM calendar_versions WHERE id = $1`,
      [draftId],
    );
    expect(row.republish_reason).toBe('verify regeneration');
    const noReason = await env
      .post(`calendar-versions/${draftId}/publish`, {
        regenerateFrom: await env.todayA(),
      })
      .expect(409);
    expect((noReason.body as ApiError).code).toBe('ALREADY_PUBLISHED');
  });

  it('GET /shift-instances is window-, unit- and tenant-scoped', async () => {
    const day = await env.todayA(1);
    const query = {
      unitId: env.world.unitA1,
      from: `${day}T06:00:00Z`,
      to: `${day}T22:00:00Z`,
    };
    const page = await env.get('shift-instances').query(query).expect(200);
    const items = page.body.items as InstanceBody[];
    expect(
      items.map((i) => [i.shiftName, i.utcStart, i.durationSeconds]),
    ).toEqual([
      ['A', `${day}T06:00:00.000Z`, 28_800],
      ['B', `${day}T14:00:00.000Z`, 28_800],
    ]);
    expect(
      (await env.get('shift-instances', env.adminB).query(query).expect(200))
        .body.items,
    ).toEqual([]);
    const paged = await env
      .get('shift-instances')
      .query({ unitId: env.world.unitA1, limit: 2 })
      .expect(200);
    expect(paged.body.nextCursor).toEqual(expect.any(String));
    const range = await env
      .get('shift-instances')
      .query({ from: query.to, to: query.from })
      .expect(422);
    expect((range.body as ApiError).code).toBe('INVALID_RANGE');
    await env
      .get('shift-instances')
      .query({ tenantId: env.world.tenantB })
      .expect(400);
  });

  it('a unit override wins for its unit from its effective date only', async () => {
    const from = await env.todayA(5);
    await env.publish({
      unitId: env.world.unitA2,
      timezone: 'UTC',
      shiftTemplates: [
        { name: 'Day', startLocal: '06:00', endLocal: '18:00' },
        { name: 'Night', startLocal: '18:00', endLocal: '06:00' },
      ],
      effectiveFrom: from,
    });
    const names = async (unitId: string, date: string) =>
      (
        await env.rows<{ shift_name: string }>(
          `SELECT shift_name FROM shift_instances WHERE unit_id = $1 AND local_date = $2 ORDER BY utc_start`,
          [unitId, date],
        )
      ).map((r) => r.shift_name);
    expect(await names(env.world.unitA2, from)).toEqual(['Day', 'Night']);
    expect(await names(env.world.unitA2, await env.todayA(4))).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(await names(env.world.unitA1, from)).toEqual(['A', 'B', 'C']);
  });

  it('crews: foreign site 422, duplicate 409; a rotation assigns crews without changing scheduled time', async () => {
    const siteB = await env.app
      .get(SitesService)
      .defaultSite(env.world.tenantB);
    const foreign = await env
      .post('crews', { siteId: siteB.id, name: 'Red' })
      .expect(422);
    expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
    const crew = (await env.post('crews', { name: 'Red' }).expect(201))
      .body as { id: string };
    expect(
      ((await env.post('crews', { name: 'Red' }).expect(409)).body as ApiError)
        .code,
    ).toBe('CREW_EXISTS');
    await env.get(`crews/${crew.id}`, env.adminB).expect(404);
    const rotation = {
      crewId: crew.id,
      pattern: { anchorDate: await env.todayA(), cycle: ['A'] },
      effectiveFrom: await env.todayA(),
    };
    const foreignCrew = await env
      .post('crew-rotations', { ...rotation, crewId: env.world.unitB1 })
      .expect(422);
    expect((foreignCrew.body as ApiError).code).toBe('INVALID_REFERENCE');
    const secondsBefore = await env.rows(
      `SELECT sum(extract(epoch FROM utc_end - utc_start))::int AS s FROM shift_instances`,
    );
    await env.post('crew-rotations', rotation).expect(201);
    const tomorrow = await env.todayA(1);
    const crews = await env.rows<{
      shift_name: string;
      crew_id: string | null;
    }>(
      `SELECT shift_name, crew_id FROM shift_instances WHERE unit_id = $1 AND local_date = $2 ORDER BY utc_start`,
      [env.world.unitA1, tomorrow],
    );
    expect(crews).toEqual([
      { shift_name: 'A', crew_id: crew.id },
      { shift_name: 'B', crew_id: null },
      { shift_name: 'C', crew_id: null },
    ]);
    expect(
      await env.rows(
        `SELECT sum(extract(epoch FROM utc_end - utc_start))::int AS s FROM shift_instances`,
      ),
    ).toEqual(secondsBefore);
    expect(
      (await env.get('crew-rotations', env.adminB).expect(200)).body.items,
    ).toEqual([]);
  });

  it('a writer limited to one unit can only write calendar versions of that unit', async () => {
    const ds = env.harness.dataSource;
    const userId = randomUUID();
    await ds.query(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit writer', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, env.world.tenantA],
    );
    await ds.query(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'unit', $3, 'master_data_admin', 1)`,
      [env.world.tenantA, userId, env.world.unitA1],
    );
    const token = signToken(env.app, {
      userId,
      tenantId: env.world.tenantA,
      role: 'Operator',
    });
    const base = {
      ...threeShiftCalendar('Asia/Tehran'),
      effectiveFrom: await env.todayA(30),
    };
    const siteWide = await env
      .post('calendar-versions', base, token)
      .expect(403);
    expect((siteWide.body as ApiError).code).toBe('SITE_SCOPE_REQUIRED');
    const otherUnit = await env
      .post('calendar-versions', { ...base, unitId: env.world.unitA2 }, token)
      .expect(422);
    expect((otherUnit.body as ApiError).code).toBe('INVALID_REFERENCE');
    await env
      .post('calendar-versions', { ...base, unitId: env.world.unitA1 }, token)
      .expect(201);
    // a site-wide draft made by a manager is out of reach for publish
    const managerDraft = await env.post('calendar-versions', base).expect(201);
    await env
      .post(
        `calendar-versions/${(managerDraft.body as { id: string }).id}/publish`,
        {},
        token,
      )
      .expect(404);
    const crew = await env
      .post('crews', { name: `scoped-${userId.slice(0, 6)}` }, token)
      .expect(403);
    expect((crew.body as ApiError).code).toBe('SITE_SCOPE_REQUIRED');
  });
});

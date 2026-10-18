import { randomUUID } from 'crypto';
import { A, ActualsWorld, B } from './support/actuals-world';
import { ApprovalInboxService } from '../../src/v2/approvals/approval-inbox.service';
import {
  anonymousContext,
  RequestContext,
} from '../../src/common/context/request-context';
import { signToken } from './support/test-app';
import {
  ApprovalChangesView,
  ApprovalInboxView,
} from '../../src/v2/approvals/approval-inbox-v2.dto';

type Item = ApprovalInboxView['items'][number];

describe('approval changes: exactly the value needing approval (isolated test DB)', () => {
  const env = new ActualsWorld();
  let superAdmin = '';
  let actor = '';
  let profileId = '';
  const created = async (path: string, body: object) =>
    (
      (await env.post(path, body, superAdmin).expect(201)).body as {
        id: string;
      }
    ).id;
  const changes = async (kind: string, id: string, token = superAdmin) =>
    (await env.get(`approval-inbox/${kind}/${id}/changes`, token).expect(200))
      .body as ApprovalChangesView;
  const rate = (value: string, effectiveFrom: string) =>
    created(`profiles/${profileId}/rates`, {
      rateKind: 'planning',
      rate: value,
      timebase: 'h',
      effectiveFrom,
    });

  beforeAll(async () => {
    await env.start();
    actor = randomUUID();
    await env.rows(
      "INSERT INTO users (id,name,email,password_hash,role,tenant_id) VALUES ($1,'Changes SuperAdmin',$2,'x','SuperAdmin',$3)",
      [actor, actor + '@test.local', env.world.tenantA],
    );
    superAdmin = signToken(env.app, {
      userId: actor,
      tenantId: env.world.tenantA,
      role: 'SuperAdmin',
    });
    profileId = await created('profiles', {
      unitId: env.world.unitA1,
      productId: env.products.p1,
      operatingMode: 'changes-test',
      quantityUom: 't',
      rateTimebase: 'h',
      effectiveFrom: '2027-01-01T00:00:00Z',
    });
  });
  afterAll(() => env.stop());

  it('diffs a pending rate against the approved one, with its unit, row headline and exact deep link', async () => {
    const first = await rate('28', '2027-01-01T00:00:00Z');
    await env.post(`rates/${first}/approve`, {}, superAdmin).expect(200);
    const second = await rate('29', '2027-02-01T00:00:00Z');
    const view = await changes('rate', second);
    expect(view).toMatchObject({ kind: 'rate', id: second, mode: 'diff' });
    const field = view.fields.find((entry) => entry.key === 'rate');
    expect(Number(field?.before)).toBe(28);
    expect(Number(field?.after)).toBe(29);
    expect(field).toMatchObject({
      unit: 't/h',
      format: 'quantity',
      changed: true,
    });
    expect(view.fields.find((entry) => entry.key === 'rateKind')?.changed).toBe(
      false,
    );
    const inbox = (
      await env
        .get('approval-inbox?kind=rate&limit=100', superAdmin)
        .expect(200)
    ).body as ApprovalInboxView;
    const row = inbox.items.find((item) => item.id === second) as Item;
    expect(row.headline).toMatchObject({
      key: 'rate',
      unit: 't/h',
      changed: true,
    });
    expect(row.reviewHref).toBe(
      `/planning/profiles/${profileId}#rate-${second}`,
    );
    expect(row.target.profileId).toBe(profileId);
    expect(row).toMatchObject({ canDecide: true, decisionBlockedReason: null });
  });

  it('shows the full content of a record without predecessor and names referenced records', async () => {
    const view = await changes('profile', profileId);
    expect(view.mode).toBe('full');
    expect(view.beforeLabel).toBeNull();
    expect(
      view.fields.find((entry) => entry.key === 'productId')?.after,
    ).not.toBe(env.products.p1);
    expect(
      view.fields.every((entry) => entry.before === null && !entry.changed),
    ).toBe(true);
  });

  it('answers like the record read: 404 out of scope or decided, 400 for an unknown kind', async () => {
    const pending = await rate('30', '2027-03-01T00:00:00Z');
    const outsider = await env.unitUser(env.world.unitA2, 'manager_approver');
    await env
      .get(`approval-inbox/rate/${pending}/changes`, outsider)
      .expect(404);
    await env
      .get(`approval-inbox/unknown/${pending}/changes`, superAdmin)
      .expect(400);
    await env.post(`rates/${pending}/retire`, {}, superAdmin).expect(200);
    await env
      .get(`approval-inbox/rate/${pending}/changes`, superAdmin)
      .expect(404);
  });

  it('keeps a decision open to a requester who may still retire, with the approve refusal explained', async () => {
    const manager = await env.unitUser(env.world.unitA1, 'manager_approver');
    const own = await env
      .post(
        'profiles',
        {
          unitId: env.world.unitA1,
          productId: env.products.p1,
          operatingMode: 'changes-own',
          quantityUom: 't',
          rateTimebase: 'h',
          effectiveFrom: '2027-01-01T00:00:00Z',
        },
        manager,
      )
      .expect(201);
    const item = (
      await env
        .get(
          `approval-inbox/profile/${(own.body as { id: string }).id}`,
          manager,
        )
        .expect(200)
    ).body as Item;
    expect(item.canDecide).toBe(true);
    expect(
      item.actions.find((action) => action.action === 'approve')
        ?.disabledReason,
    ).toBeTruthy();
  });

  it('filters to what the caller may decide in SQL and shows a disposition without predecessor in full', async () => {
    const id = await created('lot-dispositions', {
      unitId: env.world.unitA1,
      productId: env.products.p1,
      lotCode: 'CHANGES-LOT',
      dispositionClass: 'scrap',
      quantity: '2.5',
      uom: 't',
      productionStart: A,
      productionEnd: B,
      labReleasedAt: B,
      evidenceRef: 'LIMS-CHANGES',
    });
    const author: RequestContext = {
      ...anonymousContext('test'),
      userId: actor,
      tenantId: env.world.tenantA,
      roles: ['quality_approver'],
      scopes: [
        {
          kind: 'tenant',
          id: env.world.tenantA,
          tenantId: env.world.tenantA,
          role: 'quality_approver',
        },
      ],
    };
    const inbox = env.app.get(ApprovalInboxService);
    const all = await inbox.list(author, { limit: 100, kind: 'disposition' });
    const own = all.items.find((item) => item.id === id) as Item;
    expect(own).toMatchObject({
      canDecide: false,
      decisionBlockedReason:
        'A different approver must decide your own request.',
    });
    expect(own.headline).toMatchObject({
      key: 'dispositionClass',
      after: 'scrap',
      changed: false,
    });
    const decidable = await inbox.list(author, {
      limit: 100,
      kind: 'disposition',
      decidable: 'true',
    });
    expect(decidable.items.some((item) => item.id === id)).toBe(false);
    const view = await changes('disposition', id);
    expect(view.mode).toBe('full');
    expect(view.fields.find((field) => field.key === 'quantity')).toMatchObject(
      { unit: 't', format: 'quantity' },
    );
    expect(
      Number(view.fields.find((field) => field.key === 'quantity')?.after),
    ).toBe(2.5);
    await env.get('approval-inbox?decidable=maybe', superAdmin).expect(422);
  });
});

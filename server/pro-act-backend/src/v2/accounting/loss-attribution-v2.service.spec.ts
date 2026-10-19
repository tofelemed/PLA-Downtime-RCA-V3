import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { CursorCodec } from '../common/cursor-codec';
import { LossAttributionV2Service } from './loss-attribution-v2.service';
import { LossLineListQueryDto } from './loss-lines-v2.dto';

const TENANT = '00000000-0000-4000-8000-0000000000aa';
const UNIT = '00000000-0000-4000-8000-0000000000b1';
const EVENT = '00000000-0000-4000-8000-0000000000e1';

function contextOf(unitOnly = false): RequestContext {
  return {
    tenantId: TENANT,
    userId: 'u',
    roles: [],
    isSuperAdmin: false,
    scopes: unitOnly ? [{ kind: 'unit', id: UNIT, tenantId: TENANT }] : [],
  } as unknown as RequestContext;
}

function serviceWith(event: { id: string } | null, rows: unknown[][] = []) {
  const query = jest.fn((sql: string, params: unknown[]) => {
    void sql;
    void params;
    return Promise.resolve(rows.shift() ?? []);
  });
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(event),
  };
  const repo = {
    createQueryBuilder: () => qb,
    manager: { query },
  } as unknown as Repository<ProductionEvent>;
  return { service: new LossAttributionV2Service(repo), query };
}

const pickerQuery = (extra: Partial<LossLineListQueryDto> = {}) =>
  Object.assign(new LossLineListQueryDto(), { limit: 2, ...extra });

function pickerRow(id: string) {
  return {
    id,
    period_id: 'p',
    unit_id: UNIT,
    local_date: '2026-10-01',
    shift_name: 'A',
    utc_start: new Date('2026-10-01T06:00:00Z'),
    revision_id: 'r',
    revision: 1,
    lifecycle: 'draft',
    run_id: 'run',
    kind: 'availability',
    quantity: '125',
    uom: 't',
    basis: 'planning_rate',
    segment_start: new Date('2026-10-01T07:00:00Z'),
    segment_end: new Date('2026-10-01T08:00:00Z'),
    reason_code_id: null,
    reason_code: null,
    reason_name: null,
    cause_event_id: EVENT,
    event_description: 'feed',
    occurrence_id: null,
  };
}

describe('LossAttributionV2Service', () => {
  it('an event outside tenant or scope is 404 and nothing else is read', async () => {
    const { service, query } = serviceWith(null);
    await expect(
      service.attributedLosses(contextOf(), EVENT),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query).not.toHaveBeenCalled();
  });

  it('reads quantities with the unit restriction and the default view; no values query without lines', async () => {
    const { service, query } = serviceWith({ id: EVENT }, [
      [],
      [{ basis: null }],
      [],
    ]);
    const result = await service.attributedLosses(contextOf(true), EVENT);
    expect(result).toMatchObject({
      eventId: EVENT,
      valuationView: 'contribution_margin',
      valuationViewSource: 'policy_default',
      items: [],
      truncated: false,
    });
    expect(query).toHaveBeenCalledTimes(3);
    const params = query.mock.calls[2][1];
    expect(params[0]).toBe(TENANT);
    expect(params[1]).toBe(EVENT);
    expect(params[3]).toEqual([UNIT]);
    expect(params[4]).toBe(201);
  });

  it('values in the view frozen when the event’s periods were approved, not the policy default now', async () => {
    const { service, query } = serviceWith({ id: EVENT }, [
      [{ view: 'economic_impact' }],
      [],
    ]);
    const result = await service.attributedLosses(contextOf(), EVENT);
    expect(result).toMatchObject({
      valuationView: 'economic_impact',
      valuationViewSource: 'approved_snapshot',
    });
    expect(query.mock.calls[0][1]).toEqual([TENANT, [EVENT]]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('periods that froze different views fall back to the policy default', async () => {
    const { service } = serviceWith({ id: EVENT }, [
      [{ view: 'economic_impact' }, { view: 'standard_cost' }],
      [{ basis: 'standard_cost' }],
      [],
    ]);
    const result = await service.attributedLosses(contextOf(), EVENT);
    expect(result).toMatchObject({
      valuationView: 'standard_cost',
      valuationViewSource: 'policy_default',
    });
  });

  it('picker: from ≥ to is 422 INVALID_RANGE', async () => {
    const { service } = serviceWith(null);
    await expect(
      service.lossLines(
        contextOf(),
        pickerQuery({
          from: '2026-10-02T00:00:00Z',
          to: '2026-10-01T00:00:00+00:00',
        }),
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('picker: escapes the search text, defaults the kinds and pages with a cursor', async () => {
    const { service, query } = serviceWith(null, [
      [pickerRow('a'), pickerRow('b'), pickerRow('c')],
    ]);
    const page = await service.lossLines(
      contextOf(),
      pickerQuery({ q: '50%_x' }),
    );
    const params = query.mock.calls[0][1];
    expect(params[1]).toBeNull();
    expect(params[5]).toEqual(
      expect.arrayContaining(['availability', 'performance', 'quality']),
    );
    expect(params[7]).toBe('%50\\%\\_x%');
    expect(params[10]).toBe(3);
    expect(page.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(page.items[0]).toMatchObject({
      causeEventDescription: 'feed',
      periodStart: '2026-10-01T06:00:00.000Z',
    });
    expect(CursorCodec.decode(page.nextCursor ?? '')).toEqual({
      sortValue: '2026-10-01T06:00:00.000Z',
      id: 'b',
    });
  });

  it('picker: a malformed cursor is 400 INVALID_CURSOR', async () => {
    const { service } = serviceWith(null);
    const cursor = CursorCodec.encode({
      sortValue: '2026-10-01T06:00:00Z',
      id: 'not-a-uuid',
    });
    await expect(
      service.lossLines(contextOf(), pickerQuery({ cursor })),
    ).rejects.toMatchObject({ response: { code: 'INVALID_CURSOR' } });
  });
});

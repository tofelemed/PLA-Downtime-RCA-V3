/**
 * Partner Plant: a handful of v1 events on its line (the plant has no v2 feature flags), recorded by the
 * Partner Org admin, so switching plants shows that another organisation's data stays separate.
 * Events are found by `eventId` and kept.
 */
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

const UNIT_CODE = 'PP-LINE-1';

interface UnitRow {
  id: string;
  code: string;
}

interface EventRow {
  eventId: string | null;
}

/** v1 `GET /production-events` answers one page (plan 1.6: at most 200 rows). */
interface EventPage {
  items: EventRow[];
  total: number;
}

const EVENT_PAGE_SIZE = 200;

interface PartnerEvent {
  key: string;
  daysAgo: number;
  hour: number;
  minutes: number;
  eventType: 'ProductionLoss' | 'ProductionOutput';
  status: 'Open' | 'Closed' | 'Coded';
  description: string;
  quantity?: number;
}

const EVENTS: readonly PartnerEvent[] = [
  {
    key: 'L1',
    daysAgo: 6,
    hour: 9,
    minutes: 45,
    eventType: 'ProductionLoss',
    status: 'Closed',
    description: 'Filler nozzle blocked, cleaned',
  },
  {
    key: 'L2',
    daysAgo: 4,
    hour: 15,
    minutes: 120,
    eventType: 'ProductionLoss',
    status: 'Coded',
    description: 'Planned changeover to 5 L bottles',
  },
  {
    key: 'L3',
    daysAgo: 2,
    hour: 11,
    minutes: 25,
    eventType: 'ProductionLoss',
    status: 'Closed',
    description: 'Capper torque fault',
  },
  {
    key: 'L4',
    daysAgo: 1,
    hour: 20,
    minutes: 70,
    eventType: 'ProductionLoss',
    status: 'Open',
    description: 'Labeller glue system failure – waiting for technician',
  },
  {
    key: 'O1',
    daysAgo: 2,
    hour: 6,
    minutes: 480,
    eventType: 'ProductionOutput',
    status: 'Closed',
    description: 'Morning shift output',
    quantity: 41.5,
  },
  {
    key: 'O2',
    daysAgo: 1,
    hour: 6,
    minutes: 480,
    eventType: 'ProductionOutput',
    status: 'Closed',
    description: 'Morning shift output',
    quantity: 38.2,
  },
];

export async function seedPartnerEvents(ctx: ShowcaseContext): Promise<void> {
  const session = ctx.as('operators', 0);
  const units = await session.get<UnitRow[]>(`/units?tenantId=${ctx.tenantId}`);
  const unit = units.find((u) => u.code === UNIT_CODE);
  if (!unit) {
    ctx.tally.add(
      'partner events',
      0,
      0,
      `${UNIT_CODE} missing: run npm run db:seed-demo-personas first`,
    );
    return;
  }
  const known = await knownEventIds(
    session,
    `/production-events?tenantId=${ctx.tenantId}&unitId=${unit.id}`,
  );
  for (const spec of EVENTS) {
    const eventId = `SC-PP1-${spec.key}`;
    if (known.has(eventId)) {
      ctx.tally.kept('partner events');
      continue;
    }
    ctx.tally.created('partner events');
    if (ctx.dryRun) continue;
    const start =
      ctx.window.today - spec.daysAgo * DAY_MS + (spec.hour - 6) * 3_600_000;
    const body: Record<string, unknown> = {
      eventId,
      unitId: unit.id,
      tenantId: ctx.tenantId,
      eventType: spec.eventType,
      status: spec.status,
      source: 'Manual',
      description: spec.description,
      startTime: iso(start),
    };
    if (spec.status !== 'Open')
      body.endTime = iso(start + spec.minutes * 60_000);
    if (spec.quantity !== undefined) body.quantity = spec.quantity;
    await session.call('POST', '/production-events', body);
  }
}

/** Every `eventId` of the unit's v1 events, read page by page. */
async function knownEventIds(
  session: PersonaSession,
  path: string,
): Promise<Set<string | null>> {
  const known = new Set<string | null>();
  for (let page = 1; ; page += 1) {
    const result = await session.get<EventPage>(
      `${path}&page=${page}&pageSize=${EVENT_PAGE_SIZE}`,
    );
    result.items.forEach((event) => known.add(event.eventId));
    if (page * EVENT_PAGE_SIZE >= result.total) return known;
  }
}

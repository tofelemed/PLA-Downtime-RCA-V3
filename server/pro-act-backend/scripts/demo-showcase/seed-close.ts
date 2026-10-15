/**
 * Month close and day certification of the showcase (EXPERT_REVIEW Area 3, phases R-B / R-C / R-E): every
 * fully approved production day of the previous month is certified by a manager (never a submitter of its
 * shifts — the engineers submit), plus the oldest ready day of the current month; the previous month is
 * then closed (quantities by a manager, finance sign-off and lock by a finance approver) when its
 * prerequisites hold; the current month stays open. One draft shift waits for the lab (a data hold), so the
 * queue shows a paused clock next to the periods the SLA escalated. Every text says "Demo".
 */
import { ApiError, PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS } from './showcase-window';

interface DayRow {
  unitId: string;
  localDate: string;
  state: string;
  periods: Array<{ periodId: string; workflow: string }>;
}

interface MonthRow {
  monthKey: string;
  previousMonthKey: string;
  firstDate: string;
  endDate: string;
  state: string;
  prerequisites: {
    met: boolean;
    pendingCount: number;
    days: number;
    certifiedDays: number;
    openProposalCount: number;
  };
}

const STEP = 'month close';
/** the day list endpoint reads at most 62 days at once */
const CHUNK_DAYS = 60;

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function daysOf(
  ctx: ShowcaseContext,
  unitId: string,
  from: string,
  to: string,
): Promise<DayRow[]> {
  const rows: DayRow[] = [];
  const session = ctx.as('managers', 0);
  for (
    let start = Date.parse(`${from}T00:00:00Z`);
    start <= Date.parse(`${to}T00:00:00Z`);
    start += CHUNK_DAYS * DAY_MS
  ) {
    const end = Math.min(
      start + (CHUNK_DAYS - 1) * DAY_MS,
      Date.parse(`${to}T00:00:00Z`),
    );
    const page = await session.get<{ items: DayRow[] }>(
      `/v2/production-days?unitId=${unitId}&from=${isoDate(start)}&to=${isoDate(end)}`,
    );
    rows.push(...page.items);
  }
  return rows;
}

async function certify(
  ctx: ShowcaseContext,
  manager: PersonaSession,
  day: DayRow,
): Promise<void> {
  try {
    await manager.post(
      `/v2/production-days/${day.unitId}/${day.localDate}/certify`,
      { comment: 'Demo: shifts reconciled, day certified' },
      'certify production day',
      { accept: [409] },
    );
    ctx.tally.add(STEP, 1, 0, `day ${day.localDate} certified`);
  } catch (error: unknown) {
    if (!(error instanceof ApiError)) throw error;
    ctx.logger.warn(
      `day ${day.localDate} not certified: ${error.message.slice(0, 200)}`,
    );
  }
}

/** Certifies the ready days of the previous month and the oldest ready day of the current one. */
async function certifyDays(
  ctx: ShowcaseContext,
  previous: MonthRow,
  current: MonthRow,
): Promise<void> {
  const manager = ctx.as('managers', 0);
  const from = isoDate(
    Math.max(ctx.window.from, Date.parse(`${previous.firstDate}T00:00:00Z`)),
  );
  const to = isoDate(ctx.window.today - DAY_MS);
  let currentDone = false;
  for (const unitId of ctx.ids.units.values()) {
    for (const day of await daysOf(ctx, unitId, from, to)) {
      if (day.state !== 'ready') continue;
      const inPrevious = day.localDate < previous.endDate;
      if (!inPrevious && (currentDone || day.localDate < current.firstDate))
        continue;
      await certify(ctx, manager, day);
      if (!inPrevious) currentDone = true;
    }
  }
}

async function step(
  session: PersonaSession,
  month: string,
  action: string,
  body: object,
): Promise<void> {
  await session.post(
    `/v2/month-closes/${month}/${action}`,
    body,
    `month close ${action}`,
  );
}

/** Quantities closed by a manager, then finance sign-off and lock by a finance approver (separation of duties). */
async function closeMonth(
  ctx: ShowcaseContext,
  month: MonthRow,
): Promise<void> {
  if (month.state === 'locked') {
    ctx.tally.add(STEP, 0, 1, `${month.monthKey} already locked`);
    return;
  }
  if (month.state === 'open' && !month.prerequisites.met) {
    const p = month.prerequisites;
    ctx.tally.add(
      STEP,
      0,
      0,
      `${month.monthKey} not closable: ${p.pendingCount} periods open, ${p.days - p.certifiedDays} days uncertified, ${p.openProposalCount} proposals`,
    );
    return;
  }
  const finance = ctx.as('financeApprovers', 0);
  if (month.state === 'open')
    await step(ctx.as('managers', 1), month.monthKey, 'close-quantities', {
      comment: 'Demo: quantities of the month closed by plant management',
    });
  if (month.state === 'open' || month.state === 'quantities_closed')
    await step(finance, month.monthKey, 'finance-sign-off', {
      comment: 'Demo: finance sign-off',
    });
  await step(finance, month.monthKey, 'lock', {
    comment: 'Demo: month locked',
  });
  ctx.tally.add(STEP, 1, 0, `${month.monthKey} closed and locked`);
}

/** One draft shift of two days ago waits for the lab (its SLA clock pauses). */
async function holdOneDraft(ctx: ShowcaseContext): Promise<void> {
  const engineer = ctx.as('engineers', 0);
  const queue = await engineer.get<{
    items: Array<{ periodId: string; workflowState: string; onHold: boolean }>;
  }>('/v2/reconciliation-queue?limit=200');
  const draft = queue.items.find((item) => item.workflowState === 'draft');
  if (!draft || queue.items.some((item) => item.onHold)) return;
  await engineer.post(
    `/v2/production-periods/${draft.periodId}/data-holds`,
    {
      kind: 'lab',
      reason: 'Demo: waiting for the final MFI lab result of the night shift',
    },
    'waiting for data',
    { accept: [409] },
  );
  ctx.tally.add(STEP, 1, 0, 'one draft shift waits for the lab');
}

export async function seedClose(ctx: ShowcaseContext): Promise<void> {
  if (ctx.dryRun) {
    ctx.tally.add(STEP, 0, 0, 'dry run: nothing certified or closed');
    return;
  }
  const manager = ctx.as('managers', 0);
  const current = await manager.get<MonthRow>('/v2/month-closes/current');
  const previous = await manager.get<MonthRow>(
    `/v2/month-closes/${current.previousMonthKey}`,
  );
  await certifyDays(ctx, previous, current);
  await closeMonth(
    ctx,
    await manager.get<MonthRow>(`/v2/month-closes/${previous.monthKey}`),
  );
  await holdOneDraft(ctx);
}

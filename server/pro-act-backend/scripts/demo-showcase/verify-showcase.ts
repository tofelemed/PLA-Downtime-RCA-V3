/**
 * Proof of a showcase run, read back through the API only: counts per entity, yesterday's OEE and plan
 * waterfall per unit, the running stops, RCA cases by state, the accounting workflow and the valued days
 * per currency. Printed as plain lines (the `verify` step; also useful on its own with `--only verify`).
 */
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { verifyCounts } from './verify-counts';
import { DAY_MS, iso } from './showcase-window';

interface Metric {
  metric: string;
  value: string | null;
}

interface OeeGroup {
  key: string;
  metrics: Metric[];
}

interface Bar {
  key: string;
  delta: string | null;
  end: string;
}

interface Waterfall {
  bars: Bar[];
  closes: boolean;
}

interface CurrencyCell {
  currency: string;
  amount: string | null;
  status: string;
}

interface ValueGroup {
  key: string;
  currencies: CurrencyCell[];
}

const pct = (value: string | null | undefined) =>
  value === null || value === undefined
    ? 'n/a'
    : `${(Number(value) * 100).toFixed(1)} %`;
const t = (value: string | null | undefined) =>
  value === null || value === undefined ? 'n/a' : Number(value).toFixed(1);

function unitName(ctx: ShowcaseContext, unitId: string): string {
  const key = [...ctx.ids.units.entries()].find(([, id]) => id === unitId)?.[0];
  return ctx.scenario.units.find((u) => u.key === key)?.name ?? unitId;
}

async function yesterdayKpis(
  ctx: ShowcaseContext,
  session: PersonaSession,
): Promise<void> {
  const from = iso(ctx.window.today - DAY_MS);
  const to = iso(ctx.window.today);
  const unitIds = [...ctx.ids.units.values()];
  const query = new URLSearchParams({ from, to, groupBy: 'unit' });
  unitIds.forEach((id) => query.append('unitIds', id));
  const oee = await session.get<{ data: { groups: OeeGroup[] } }>(
    `/v2/reports/oee?${query}`,
  );
  ctx.logger.log(
    `— yesterday (${from.slice(0, 10)}) per unit: availability / performance / quality / OEE, plan waterfall (t)`,
  );
  for (const unitId of unitIds) {
    const group = oee.data.groups.find((g) => g.key === unitId);
    const m = (name: string) =>
      pct(group?.metrics.find((x) => x.metric === name)?.value);
    const periods = await session.listAll<{ periodId: string }>(
      '/v2/period-summaries',
      { unitIds: unitId, from, to },
    );
    const wq = new URLSearchParams({ ledger: 'plan' });
    periods.forEach((p) => wq.append('periodIds', p.periodId));
    const fall = periods.length
      ? await session.get<Waterfall>(`/v2/reports/waterfall?${wq}`)
      : { bars: [], closes: false };
    const bar = (key: string) => fall.bars.find((b) => b.key === key);
    const steps = fall.bars
      .filter((b) => b.delta !== null)
      .map((b) => `${b.key} ${t(b.delta)}`)
      .join(', ');
    ctx.logger.log(
      `  ${unitName(ctx, unitId).padEnd(24)} A ${m('availability')}  P ${m('performance')}  Q ${m('quality')}  OEE ${m('oee')}` +
        `  | target ${t(bar('target')?.end)} → ${steps} → good ${t(bar('actual')?.end)}  closes=${fall.closes}`,
    );
  }
}

async function valuedDays(
  ctx: ShowcaseContext,
  session: PersonaSession,
): Promise<void> {
  const query = new URLSearchParams({
    from: iso(ctx.window.from),
    to: iso(ctx.window.today),
    groupBy: 'day',
  });
  ctx.ids.units.forEach((id) => query.append('unitIds', id));
  const report = await session.get<{
    data: { groups: ValueGroup[]; total: { currencies: CurrencyCell[] } };
  }>(`/v2/reports/loss-value?${query}`);
  const byCurrency = new Map<
    string,
    { valued: number; other: Map<string, number> }
  >();
  for (const group of report.data.groups) {
    for (const cell of group.currencies) {
      const entry = byCurrency.get(cell.currency) ?? {
        valued: 0,
        other: new Map<string, number>(),
      };
      if (cell.status === 'valued') entry.valued += 1;
      else
        entry.other.set(cell.status, (entry.other.get(cell.status) ?? 0) + 1);
      byCurrency.set(cell.currency, entry);
    }
  }
  const totals = report.data.total.currencies.map(
    (c) =>
      `${c.currency} ${Number(c.amount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} (${c.status})`,
  );
  ctx.logger.log(
    `— loss value (contribution margin, plan ledger) of the window: ${totals.join(', ')}`,
  );
  for (const [currency, entry] of byCurrency) {
    const other = [...entry.other.entries()]
      .map(([s, n]) => `${n} ${s}`)
      .join(', ');
    ctx.logger.log(
      `  ${currency}: ${entry.valued} of ${report.data.groups.length} days valued${other ? `, ${other}` : ''}`,
    );
  }
}

export async function verifyShowcase(ctx: ShowcaseContext): Promise<void> {
  const session = ctx.as('managers', 0);
  await verifyCounts(ctx, session);
  if (ctx.scenario.kind === 'partner' || ctx.ids.units.size === 0) return;
  await yesterdayKpis(ctx, session);
  await valuedDays(ctx, session);
}

/** Demo accounting cases with documentary evidence; every write follows the public workflow API. */
import { formatDec, parseDec } from './fixed-decimal';
import { loadPeriods } from './period-loader';
import { ReconciliationView, sliceLines } from './reconcile-period';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS } from './showcase-window';

interface Reversible {
  id: string;
  kind: string;
  remainingQuantity: string;
}

function inventoryBridge(
  sliceId: string,
  reasonCodeId: string,
): Record<string, unknown> {
  return {
    action: 'manual',
    sliceId,
    kind: 'bridge',
    quantity: '2',
    missingEvent: true,
    reasonCodeId,
    classification: 'inventory',
    evidenceType: 'movement_record',
    evidenceRef: 'DEMO-SILO-120-TRANSFER-02',
    reason:
      'Demo: 2 t pellet inventory retained between extrusion and bagging at shift cut-off',
  };
}

async function priorLossReversal(
  accountant: PersonaSession,
  path: string,
  sliceId: string,
): Promise<Record<string, unknown>> {
  const choices = await accountant.get<{ items: Reversible[] }>(
    `${path}/reversible-lines`,
  );
  const original = choices.items.find(
    (row) =>
      ['availability', 'performance'].includes(row.kind) &&
      parseDec(row.remainingQuantity) >= parseDec('0.5'),
  );
  if (!original)
    throw new Error('Demo reversal: no eligible previously approved loss');
  return {
    action: 'manual',
    sliceId,
    kind: 'reversal',
    quantity: '-0.5',
    reversesLineId: original.id,
    evidenceType: 'log',
    evidenceRef: 'DEMO-SHIFT-LOG-CORRECTION-005',
    reason:
      'Demo: maintenance review identified 0.5 t counted twice in the earlier approved loss; awaiting review',
  };
}

function baselineLines(
  current: ReconciliationView,
  firstId: string,
  bridge: boolean,
  reasonId: string,
): Record<string, unknown>[] {
  return current.slices.flatMap((slice) =>
    sliceLines(
      bridge && slice.sliceId === firstId
        ? { ...slice, gap: formatDec(parseDec(slice.gap) - parseDec('2')) }
        : slice,
      current.candidates.filter(
        (candidate) => candidate.sliceId === slice.sliceId,
      ),
      reasonId,
    ),
  );
}

async function correctionDraft(
  ctx: ShowcaseContext,
  unitKey: string,
): Promise<void> {
  const unitId = ctx.ids.units.get(unitKey);
  if (!unitId) return;
  const accountant = ctx.as('accountants', 0);
  const start = ctx.window.today - 2 * DAY_MS;
  const period = (
    await loadPeriods(accountant, unitId, start, start + DAY_MS)
  ).find((row) => row.shiftName === 'Night');
  if (!period)
    throw new Error(`Demo correction: ${unitKey} night shift missing`);
  const path = `/v2/production-periods/${period.id}`;
  const current = await accountant.get<ReconciliationView>(
    `${path}/reconciliation`,
  );
  if (current.revision.lifecycle !== 'draft') return;
  const first = current.slices.find(
    (slice) => parseDec(slice.gap) > parseDec('2'),
  );
  if (!first)
    throw new Error(`Demo correction: ${unitKey} has no eligible shortfall`);
  const bridge = unitKey === 'EXT1';
  const inventoryReason = ctx.ids.reasons.get('MATL-SILO');
  if (bridge && !inventoryReason)
    throw new Error(
      'Demo inventory bridge requires the silo-transfer reason code',
    );
  const lines = baselineLines(
    current,
    first.sliceId,
    bridge,
    ctx.ids.reasons.get('PROC-SPEED') ?? '',
  );
  lines.push(
    bridge
      ? inventoryBridge(first.sliceId, inventoryReason!)
      : await priorLossReversal(accountant, path, first.sliceId),
  );
  await accountant.call(
    'PUT',
    `${path}/draft-lines`,
    {
      revision: current.revision.revision,
      baseRunId: current.baseRunId,
      lines,
    },
    { ifMatch: current.rowVersion },
  );
  ctx.tally.created(
    bridge ? 'HDPE inventory bridge draft' : 'HDPE prior loss reversal draft',
  );
}

export async function seedHdpeCorrections(ctx: ShowcaseContext): Promise<void> {
  if (ctx.dryRun) return;
  await correctionDraft(ctx, 'EXT1');
  await correctionDraft(ctx, 'EXT2');
}

/**
 * Guide lesson 8 / E2E §5: the reason codes with their defaults (Bahram, master data), the gearbox failure
 * dictionary (Farid, reliability; one idempotent import) and the RCA cause catalogue that investigations
 * need for a coded root cause before closure (Bahram). Codes take effect at the commissioning instant.
 * Ordinary codes save directly; there is no separate approval step for them.
 */
import {
  DICTIONARY,
  RCA_CAUSES,
  REASONS,
  ReasonSpec,
} from './train-catalog-codes';
import { TIMES } from './train-catalog';
import { TrainContext } from './train-context';

interface CodeRow {
  id: string;
  code: string;
}

interface ImportResult {
  total: number;
  created: number;
  superseded: number;
  unchanged: number;
}

function reasonBody(
  spec: ReasonSpec,
  parentId: string | undefined,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    code: spec.code,
    name: spec.name,
    category: spec.category,
    effectiveFrom: TIMES.commissioningFrom,
  };
  if (spec.description) body.description = spec.description;
  if (spec.oee) body.defaultOeeComponent = spec.oee;
  if (spec.schedule) body.defaultScheduleClass = spec.schedule;
  if (parentId) body.parentId = parentId;
  return body;
}

async function seedReasons(ctx: TrainContext): Promise<void> {
  const author = ctx.as('bahram');
  const rows = await author.listAll<CodeRow>('/v2/reason-codes', {
    includeRetired: 'true',
  });
  const ids = new Map(rows.map((row) => [row.code, row.id]));
  for (const spec of REASONS) {
    if (ids.has(spec.code)) {
      ctx.tally.kept('reason codes');
      continue;
    }
    ctx.tally.created('reason codes');
    if (ctx.dryRun) continue;
    const parentId = spec.parent ? ids.get(spec.parent) : undefined;
    if (spec.parent && !parentId)
      throw new Error(`reason ${spec.code}: parent ${spec.parent} missing`);
    const created = await author.post<CodeRow>(
      '/v2/reason-codes',
      reasonBody(spec, parentId),
      `reason ${spec.code}`,
    );
    ids.set(spec.code, created.id);
  }
}

async function seedDictionary(ctx: TrainContext): Promise<void> {
  const author = ctx.as('farid');
  const body = {
    entries: DICTIONARY.map((e) => ({ ...e })),
    effectiveFrom: TIMES.commissioningFrom,
  };
  const check = await author.post<ImportResult>(
    '/v2/failure-dictionary/import',
    { ...body, dryRun: true },
    'failure dictionary check',
  );
  ctx.tally.add(
    'failure dictionary',
    check.created + check.superseded,
    check.unchanged,
  );
  if (ctx.dryRun || check.created + check.superseded === 0) return;
  await author.post(
    '/v2/failure-dictionary/import',
    body,
    'failure dictionary import',
  );
}

async function seedRcaCauses(ctx: TrainContext): Promise<void> {
  const author = ctx.as('bahram');
  const rows = await author.listAll<CodeRow>('/v2/rca-causes');
  const codes = new Set(rows.map((row) => row.code));
  for (const cause of RCA_CAUSES) {
    if (codes.has(cause.code)) {
      ctx.tally.kept('rca causes');
      continue;
    }
    ctx.tally.created('rca causes');
    if (!ctx.dryRun)
      await author.post(
        '/v2/rca-causes',
        { ...cause },
        `rca cause ${cause.code}`,
      );
  }
}

export async function seedCodes(ctx: TrainContext): Promise<void> {
  await seedReasons(ctx);
  await seedDictionary(ctx);
  await seedRcaCauses(ctx);
}

/**
 * Code libraries of the showcase through the v2 code routes, authored by a master-data admin: impact
 * codes, OEE codes, the reason tree with its defaults, failure codes and loss categories. Codes are found
 * by code (also retired ones) and kept; the mapping rules and declarative rules follow in `seed-rules.ts`.
 */
import {
  FAILURE_CODES,
  FailureNode,
  IMPACT_CODES,
  LOSS_CATEGORIES,
  OEE_CODES,
  REASON_TREE,
  SimpleCode,
} from './catalog-codes';
import { MASTER_DATA_FROM } from './catalog-plants';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';

interface CodeRow {
  id: string;
  code: string;
}

type Library =
  | 'reason-codes'
  | 'impact-codes'
  | 'oee-codes'
  | 'failure-code-groups'
  | 'loss-category-defs';

const EFFECTIVE_FROM = `${MASTER_DATA_FROM}T00:00:00.000Z`;

async function existingCodes(
  session: PersonaSession,
  library: Library,
): Promise<Map<string, string>> {
  const rows = await session.listAll<CodeRow>(`/v2/${library}`, {
    includeRetired: 'true',
  });
  return new Map(rows.map((row) => [row.code, row.id]));
}

/** Finds a code by `code` or creates it; returns its id ('' in a dry run). */
async function ensureCode(
  ctx: ShowcaseContext,
  library: Library,
  known: Map<string, string>,
  body: Record<string, unknown> & { code: string },
): Promise<string> {
  const found = known.get(body.code);
  if (found) {
    ctx.tally.kept(library);
    return found;
  }
  ctx.tally.created(library);
  if (ctx.dryRun) return '';
  const created = await ctx
    .as('authors', 0)
    .post<CodeRow>(
      `/v2/${library}`,
      { effectiveFrom: EFFECTIVE_FROM, ...body },
      `code ${library} ${body.code}`,
    );
  known.set(body.code, created.id);
  return created.id;
}

async function seedSimple(
  ctx: ShowcaseContext,
  library: Library,
  codes: readonly SimpleCode[],
  extra: (code: SimpleCode) => Record<string, unknown> = () => ({}),
): Promise<Map<string, string>> {
  const known = await existingCodes(ctx.as('authors', 0), library);
  for (const code of codes) {
    const body: Record<string, unknown> & { code: string } = {
      code: code.code,
      name: code.name,
      ...extra(code),
    };
    if (code.description) body.description = code.description;
    await ensureCode(ctx, library, known, body);
  }
  return known;
}

async function seedReasonTree(ctx: ShowcaseContext): Promise<void> {
  const known = await existingCodes(ctx.as('authors', 0), 'reason-codes');
  for (const root of REASON_TREE) {
    const rootId = await ensureCode(ctx, 'reason-codes', known, {
      code: root.code,
      name: root.name,
      category: root.category,
    });
    ctx.ids.reasons.set(root.code, rootId);
    for (const leaf of root.leaves) {
      const impactId = ctx.ids.impacts.get(leaf.impact);
      const body: Record<string, unknown> & { code: string } = {
        code: leaf.code,
        name: leaf.name,
        category: root.category,
        defaultOeeComponent: leaf.oee,
        defaultScheduleClass: leaf.schedule,
      };
      if (rootId) body.parentId = rootId;
      if (impactId) body.defaultImpactCodeId = impactId;
      ctx.ids.reasons.set(
        leaf.code,
        await ensureCode(ctx, 'reason-codes', known, body),
      );
    }
  }
}

async function seedFailureNodes(
  ctx: ShowcaseContext,
  known: Map<string, string>,
  nodes: readonly FailureNode[],
  parentId: string | null,
): Promise<void> {
  for (const node of nodes) {
    const body: Record<string, unknown> & { code: string } = {
      code: node.code,
      name: node.name,
      groupKind: node.kind,
    };
    if (parentId) body.parentId = parentId;
    const id = await ensureCode(ctx, 'failure-code-groups', known, body);
    await seedFailureNodes(ctx, known, node.children, id || null);
  }
}

export async function seedCodeLibraries(ctx: ShowcaseContext): Promise<void> {
  const impacts = await seedSimple(ctx, 'impact-codes', IMPACT_CODES);
  impacts.forEach((id, code) => ctx.ids.impacts.set(code, id));
  await seedSimple(ctx, 'oee-codes', OEE_CODES);
  await seedReasonTree(ctx);
  const failures = await existingCodes(
    ctx.as('authors', 0),
    'failure-code-groups',
  );
  await seedFailureNodes(ctx, failures, FAILURE_CODES, null);
  await seedSimple(ctx, 'loss-category-defs', LOSS_CATEGORIES, (code) => ({
    reportOrder: LOSS_CATEGORIES.indexOf(code) + 1,
  }));
}

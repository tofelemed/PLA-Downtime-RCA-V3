/**
 * The codes the simulator's attributes name (`SIM_CODE_VALUES`, codes): `MasterDataCodeResolverService`
 * resolves them by exact code or name, so each must exist in the tenant's library. An existing code
 * (case-insensitive) is reused whatever its name; a missing one is created through the code-libraries
 * v2 API with the plan's name.
 */
import { CodePlan, SIM_CODES } from './demo-mqtt-plan';
import {
  createUnlessDryRun,
  Outcome,
  report,
  sameText,
  SeedContext,
  seedKey,
} from './seed-support';

type Library = 'reason-codes' | 'impact-codes' | 'oee-codes';

interface CodeRow {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface EnsureCode {
  library: Library;
  rows: readonly CodeRow[];
  plan: CodePlan;
  /** library-specific fields of the create body (reason code defaults) */
  extra: Record<string, unknown>;
}

interface EnsuredCode {
  id: string | null;
  outcome: Outcome;
}

function loadLibrary(ctx: SeedContext, library: Library): Promise<CodeRow[]> {
  return ctx.client.listAll<CodeRow>(`/api/v2/${library}`);
}

async function ensureCode(
  ctx: SeedContext,
  input: EnsureCode,
): Promise<EnsuredCode> {
  const { library, rows, plan, extra } = input;
  const what = `${library} ${plan.code} "${plan.name}"`;
  const found = rows.find((row) => row.active && sameText(row.code, plan.code));
  if (found) {
    const note = `${found.code} "${found.name}"`;
    return {
      id: found.id,
      outcome: report(ctx, { what, status: 'kept', id: found.id, note }),
    };
  }
  const outcome = await createUnlessDryRun(ctx, what, async () => {
    const { body } = await ctx.client.write<CodeRow>(
      'POST',
      `/api/v2/${library}`,
      { code: plan.code, name: plan.name, ...extra },
      { idempotencyKey: seedKey([ctx.tenantId, library, plan.code]) },
    );
    return { id: body.id };
  });
  return { id: outcome.id, outcome };
}

/** Impact and OEE codes first: the reason codes default to the impact code so stops are costed. */
export async function ensureCodes(ctx: SeedContext): Promise<Outcome[]> {
  const impact = await ensureCode(ctx, {
    library: 'impact-codes',
    rows: await loadLibrary(ctx, 'impact-codes'),
    plan: SIM_CODES.impact,
    extra: {},
  });
  const oee = await ensureCode(ctx, {
    library: 'oee-codes',
    rows: await loadLibrary(ctx, 'oee-codes'),
    plan: SIM_CODES.oee,
    extra: {},
  });
  const reasons = await loadLibrary(ctx, 'reason-codes');
  const outcomes = [impact.outcome, oee.outcome];
  for (const plan of SIM_CODES.reason) {
    const ensured = await ensureCode(ctx, {
      library: 'reason-codes',
      rows: reasons,
      plan,
      extra: {
        defaultOeeComponent: 'availability',
        defaultScheduleClass: 'unplanned',
        ...(impact.id ? { defaultImpactCodeId: impact.id } : {}),
      },
    });
    outcomes.push(ensured.outcome);
  }
  return outcomes;
}

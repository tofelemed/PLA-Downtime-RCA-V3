/**
 * Guide lesson 9 / E2E §13: MQTT output priority for Extruder1 at boundary extruder_outlet. The
 * integration administrator (Mina) proposes it and the production accountant (Sara), who governs
 * measurement authority, approves it: approval needs a production accountant other than the proposer, and
 * Reza (manager approver) does not hold that role. Commissioning backdate to 17 Oct 2026 02:00Z (owner,
 * DECISIONS 2026-10-18), allowed only while no period of the unit has been calculated.
 */
import {
  BACKDATE_INSTANTS,
  BACKDATE_REASON,
  SOURCE_AUTHORITY,
} from './train-catalog-setup';
import { known, TrainContext } from './train-context';

interface AuthorityInForce {
  unitId: string | null;
  policy: { primarySource?: string };
}

interface AuthorityVersion {
  id: string;
  state: string;
  policy: { primarySource?: string };
}

async function mqttInForce(
  ctx: TrainContext,
  unitId: string,
): Promise<boolean> {
  const current = await ctx
    .as('sara')
    .get<AuthorityInForce>(`/v2/source-authority?unitId=${unitId}`);
  return current.unitId === unitId && current.policy.primarySource === 'mqtt';
}

async function proposal(
  ctx: TrainContext,
  unitId: string,
): Promise<AuthorityVersion> {
  const drafts = await ctx
    .as('mina')
    .listAll<AuthorityVersion>('/v2/source-authority/versions', {
      unitId,
      state: 'proposed',
    });
  const open = drafts.find((d) => d.policy.primarySource === 'mqtt');
  if (open) return open;
  const { measurementHierarchy, notes } = SOURCE_AUTHORITY;
  return ctx.as('mina').post<AuthorityVersion>(
    '/v2/source-authority/versions',
    {
      unitId,
      measurementHierarchy,
      notes,
      effectiveFrom: BACKDATE_INSTANTS.sourceAuthority,
      backdateReason: BACKDATE_REASON,
    },
    'source authority Extruder1 mqtt',
  );
}

export async function seedSourceAuthority(ctx: TrainContext): Promise<void> {
  if (!known(ctx, ctx.ids.unitId, 'unit Extruder1')) return;
  const unitId = ctx.ids.unitId;
  if (await mqttInForce(ctx, unitId)) {
    ctx.tally.kept('source authority');
    return;
  }
  ctx.tally.add(
    'source authority',
    1,
    0,
    `MQTT, backdated to ${BACKDATE_INSTANTS.sourceAuthority}`,
  );
  if (ctx.dryRun) return;
  const draft = await proposal(ctx, unitId);
  await ctx
    .as('sara')
    .post(
      `/v2/source-authority/versions/${draft.id}/approve`,
      { reason: SOURCE_AUTHORITY.approvalReason },
      `approve source authority ${draft.id}`,
    );
}

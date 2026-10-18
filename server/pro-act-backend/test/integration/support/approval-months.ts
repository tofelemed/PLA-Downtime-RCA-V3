import { monthCloseDefault } from '../../../src/domain/close/month-close-policy';
import { ActualsWorld } from './actuals-world';
/** Saved close states used by the approval routing integration test; isolated test database only. */
export async function seedApprovalMonths(
  env: ActualsWorld,
  actor: string,
): Promise<void> {
  const policyBody = monthCloseDefault({
    timezone: 'UTC',
    calendarSystem: 'gregorian',
  });
  const [policy] = await env.rows<{ id: string; version: number }>(
    `INSERT INTO accounting_policies (tenant_id,row_version,policy_kind,scope_key,version,body,effective_from,approved_at) VALUES ($1,1,'month_close','tenant',(SELECT coalesce(max(version),0)+1 FROM accounting_policies WHERE tenant_id=$1 AND policy_kind='month_close'),$2,'2026-01-01',now()) RETURNING id,version`,
    [env.world.tenantA, policyBody],
  );
  const cases = [
    ['2027-01', '2027-01-01', '2027-02-01', 'quantities_closed', true],
    ['2027-02', '2027-02-01', '2027-03-01', 'quantities_closed', false],
    ['2027-03', '2027-03-01', '2027-04-01', 'finance_signed_off', false],
  ];
  for (const [monthKey, first, end, state, materiality] of cases)
    await env.rows(
      `INSERT INTO month_closes (tenant_id,row_version,calendar,month_key,first_date,end_date,state,policy_id,policy_version,quantities_closed_by,quantities_closed_at,materiality_required,finance_signed_off_by,finance_signed_off_at) VALUES ($1,1,'gregorian',$2,$3,$4,$5,$6,$7,$8,now(),$9,$10,$11)`,
      [
        env.world.tenantA,
        monthKey,
        first,
        end,
        state,
        policy.id,
        policy.version,
        actor,
        materiality,
        state === 'finance_signed_off' ? actor : null,
        state === 'finance_signed_off' ? new Date() : null,
      ],
    );
}

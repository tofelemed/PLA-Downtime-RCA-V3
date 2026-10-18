/**
 * Read-only verification of HDPE-TRAIN: prints one line per check (area, result, detail, ids) and sets a
 * non-zero exit code when any guide expectation is not met. Writes nothing.
 */
import { TrainContext } from './train-context';
import {
  checkCalendar,
  checkCodes,
  checkMasterData,
  checkPeople,
  checkPlant,
  checkProfiles,
} from './verify-checks-setup';
import {
  checkAuthority,
  checkFinance,
  checkIntegration,
  checkPlan,
  checkPolicies,
} from './verify-checks-flow';
import { Check, resolveRefs } from './verify-support';

function line(result: Check): string {
  const ids = result.ids?.filter(Boolean) ?? [];
  const shown =
    ids.length > 3
      ? `${ids.slice(0, 3).join(', ')} … (+${ids.length - 3})`
      : ids.join(', ');
  return `${result.ok ? 'OK  ' : 'FAIL'} ${result.area.padEnd(38)} ${result.detail}${shown ? `  [${shown}]` : ''}`;
}

export async function verifyTrain(ctx: TrainContext): Promise<boolean> {
  const refs = await resolveRefs(ctx);
  const results: Check[] = [
    ...(await checkPlant(ctx)),
    ...(await checkPeople(refs, ctx.tenantId)),
    ...(await checkMasterData(refs)),
    ...(await checkCodes(refs)),
    ...(await checkCalendar(refs)),
    ...(await checkProfiles(refs)),
  ];
  if (refs.unitId) {
    results.push(
      ...(await checkPolicies(refs)),
      ...(await checkIntegration(refs)),
      ...(await checkAuthority(refs)),
      ...(await checkFinance(refs)),
      ...(await checkPlan(refs)),
    );
  }
  ctx.logger.log(`verification of HDPE-TRAIN (${ctx.tenantId})`);
  results.forEach((result) => ctx.logger.log(line(result)));
  const failed = results.filter((r) => !r.ok).length;
  ctx.logger.log(`${results.length - failed}/${results.length} checks passed`);
  return failed === 0;
}

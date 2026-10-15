import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { MicroStopPolicyCreateDto } from './micro-stop-policy-v2.dto';
import {
  OeePolicyVersionsService,
  PolicyInForce,
} from './oee-policy-versions.service';

export type { PolicyInForce } from './oee-policy-versions.service';

/**
 * SME D6 over HTTP: the micro-stop threshold of a unit or the plant, per asset class, and the trip reasons
 * that are always events — written as a new approved `oee_policy` version of the scope (effective now),
 * every other field kept from the version in force (`OeePolicyVersionsService`).
 */
@Injectable()
export class MicroStopPolicyV2Service {
  constructor(private readonly versions: OeePolicyVersionsService) {}

  current(
    context: RequestContext,
    unitId: string | undefined,
  ): Promise<PolicyInForce> {
    return this.versions.current(context, unitId);
  }

  create(
    context: RequestContext,
    dto: MicroStopPolicyCreateDto,
  ): Promise<PolicyInForce> {
    return this.versions.write(context, dto, (base) => ({
      ...base,
      microStopSeconds: dto.microStopSeconds,
      microStopSecondsByAssetClass:
        dto.microStopSecondsByAssetClass ?? base.microStopSecondsByAssetClass,
      tripReasonCodes: dto.tripReasonCodes ?? base.tripReasonCodes,
    }));
  }
}

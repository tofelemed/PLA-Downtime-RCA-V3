import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import {
  OeePolicyVersionsService,
  PolicyInForce,
} from './oee-policy-versions.service';
import { TransitionAllowanceCreateDto } from './transition-allowance-v2.dto';

/**
 * Engine 2.5.6 over HTTP: whether a unit's or the plant's plan already allows for standard grade
 * transitions (`planned`) or counts the allowance against the plan (`loss`), written as a new approved
 * `oee_policy` version effective now; every other field is kept from the version in force, and periods
 * already calculated keep the version they used.
 */
@Injectable()
export class TransitionAllowanceV2Service {
  constructor(private readonly versions: OeePolicyVersionsService) {}

  current(
    context: RequestContext,
    unitId: string | undefined,
  ): Promise<PolicyInForce> {
    return this.versions.current(context, unitId);
  }

  create(
    context: RequestContext,
    dto: TransitionAllowanceCreateDto,
  ): Promise<PolicyInForce> {
    return this.versions.write(context, dto, (base) => ({
      ...base,
      transitionAllowanceInPlan: dto.transitionAllowanceInPlan,
    }));
  }
}

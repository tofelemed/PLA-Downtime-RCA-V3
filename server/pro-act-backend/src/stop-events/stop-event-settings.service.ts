import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import {
  StopEventOptions,
  stopEventSettings,
} from '../periods/stop-event-options';
import { UnitScope } from './derived-stop-writer';

export interface StopEventSettingsInForce {
  settings: StopEventOptions;
  /** the `oee_policy` version that supplied them */
  policyVersionId: string | null;
}

/**
 * Stop-event settings of a unit at an instant: the `stopEvents` option of the `oee_policy` version in
 * force (unit override, else tenant-wide; seeded with the D04 default on first use) over the pilot defaults.
 */
@Injectable()
export class StopEventSettingsService {
  constructor(private readonly policies: AccountingPoliciesService) {}

  async resolve(
    manager: EntityManager,
    scope: UnitScope,
    at: Date,
  ): Promise<StopEventSettingsInForce> {
    const engine = await this.policies.resolveEngine(manager, scope, at);
    const ref = engine.refs.find((r) => r.kind === 'oee_policy');
    return {
      settings: stopEventSettings(engine.oee),
      policyVersionId: ref?.id ?? null,
    };
  }
}

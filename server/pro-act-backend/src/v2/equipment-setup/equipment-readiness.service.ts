import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Clock } from '../../common/clock/clock';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { ReadinessStore } from './readiness-store';
import { ReadinessRecordsService } from './readiness-records.service';
import { ReadinessProfilesService } from './readiness-profiles.service';
import { ReadinessPoliciesService } from './readiness-policies.service';
import { ReadinessFinanceService } from './readiness-finance.service';
import { ReadinessTelemetryService } from './readiness-telemetry.service';
import { ReadinessWorkflowService } from './readiness-workflow.service';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';
import { EquipmentReadinessView } from './readiness-v2.view';

@Injectable()
export class EquipmentReadinessService {
  constructor(
    private readonly store: ReadinessStore,
    private readonly records: ReadinessRecordsService,
    private readonly profiles: ReadinessProfilesService,
    private readonly policies: ReadinessPoliciesService,
    private readonly finance: ReadinessFinanceService,
    private readonly telemetry: ReadinessTelemetryService,
    private readonly workflow: ReadinessWorkflowService,
    private readonly clock: Clock,
  ) {}
  async read(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
  ): Promise<EquipmentReadinessView> {
    assertReadinessWindow(query);
    const unit = await this.store.unit(context, query.unitId);
    const [records, profiles, policies, workflow] = await Promise.all([
      this.records.read(context, query, unit),
      this.profiles.read(context, query),
      this.policies.read(context, query),
      this.workflow.read(context, query),
    ]);
    const [finance, telemetry] = await Promise.all([
      this.finance.read(context, query, { profiles, policies }),
      this.telemetry.read(context, query, policies),
    ]);
    return {
      asOf: this.clock.now().toISOString(),
      tenantId: requireTenantId(context),
      unitId: unit.id,
      productId: query.productId ?? null,
      operatingMode: query.operatingMode ?? 'normal',
      from: new Date(query.from).toISOString(),
      to: new Date(query.to).toISOString(),
      checks: [
        ...records,
        ...profiles.checks,
        ...policies.checks,
        ...telemetry,
        ...finance,
        ...workflow,
      ],
    };
  }
}
export function assertReadinessWindow(query: EquipmentReadinessQueryDto) {
  const span = Date.parse(query.to) - Date.parse(query.from);
  if (!(span > 0 && span <= 31 * 86_400_000))
    throw new UnprocessableEntityException({
      code: 'INVALID_RANGE',
      message:
        'Readiness requires from before to and a window of at most 31 days.',
    });
}

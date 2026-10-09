import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { getRequestContext } from '../common/context/request-context';
import { RequestWithContext } from '../common/context/request-context.middleware';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * v1 Plan Dashboard writes (`reconcile-forms`, `loss-categories`, `oee-summaries`) answer 410 Gone
 * `V1_WRITE_GONE` for a tenant whose `v2.planDashboard` flag is on (plan 3.5 DoD, B9 / B10): reconciliation
 * is saved through `PUT /api/v2/production-periods/{id}/draft-lines` and OEE comes from calculation runs.
 * Tenants still on the v1 screen keep the deprecated writes (decision C4).
 */
@Injectable()
export class PlanDashboardV1WriteGuard implements CanActivate {
  constructor(private readonly flags: FeatureFlagsService) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithContext>();
    const tenantId = (request.requestContext ?? getRequestContext())?.tenantId;
    if (!tenantId) return true;
    if (!(await this.flags.isEnabled(tenantId, 'v2.planDashboard')))
      return true;
    throw new GoneException({
      code: 'V1_WRITE_GONE',
      message:
        'This v1 write is retired for this plant (v2.planDashboard): save reconciliation lines with PUT /api/v2/production-periods/{id}/draft-lines; OEE comes from calculation runs.',
    });
  }
}

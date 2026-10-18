import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { RcaAction } from '../rca/entities/rca-action.entity';
import {
  RcaBaselineCorrectionDto,
  RcaBaselineDecisionDto,
} from '../v2/rca/rca-actions-v2.dto';
import { RcaActionV2View, toActionView } from './rca-action.view';
import { RcaActionsService } from './rca-actions.service';
import { scopeOf } from './rca-scope';

type Target = { id: string; expectedRowVersion: number };

/**
 * CA3 baseline corrections: the computed baseline is kept; a writer proposes a corrected value with its
 * reason (e.g. a duplicate record), and someone other than the proposer — a manager approver — approves
 * or rejects it. An approved correction replaces the counted value in the verdict, and the action is
 * evaluated again; the original count and the explanation stay on the action.
 */
@Injectable()
export class RcaBaselineCorrectionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly actions: RcaActionsService,
  ) {}

  propose(
    context: RequestContext,
    target: Target,
    body: RcaBaselineCorrectionDto,
  ): Promise<RcaActionV2View> {
    const scope = scopeOf(context);
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const { action } = await this.actions.lockAction(
        manager,
        scope,
        target.id,
      );
      assertRevision(action.rowVersion, target.expectedRowVersion);
      if (
        !action.baseline ||
        action.baseline.declared ||
        !action.baseline.window
      ) {
        throw new ConflictException({
          code: 'BASELINE_NOT_COMPUTED',
          message:
            'only a baseline computed from history can be corrected; plan the verification first',
        });
      }
      action.baseline = {
        ...action.baseline,
        correction: {
          value: body.value,
          reason: body.reason.trim(),
          status: 'pending',
          proposedBy: scope.userId,
          proposedAt: now.toISOString(),
          decidedBy: null,
          decidedAt: null,
          note: null,
        },
      };
      return toActionView(
        await manager.getRepository(RcaAction).save(action),
        now,
      );
    });
  }

  decide(
    context: RequestContext,
    target: Target,
    body: RcaBaselineDecisionDto,
  ): Promise<RcaActionV2View> {
    const scope = scopeOf(context);
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const { action } = await this.actions.lockAction(
        manager,
        scope,
        target.id,
      );
      assertRevision(action.rowVersion, target.expectedRowVersion);
      const correction = action.baseline?.correction;
      if (!action.baseline || correction?.status !== 'pending') {
        throw new ConflictException({
          code: 'NO_PENDING_CORRECTION',
          message: 'the baseline has no correction waiting for a decision',
        });
      }
      if (
        !context.isSuperAdmin &&
        correction.proposedBy &&
        correction.proposedBy === scope.userId
      ) {
        throw new ForbiddenException({
          code: 'SEPARATION_OF_DUTIES',
          message:
            'a baseline correction is decided by someone other than its proposer',
        });
      }
      action.baseline = {
        ...action.baseline,
        correction: {
          ...correction,
          status: body.approve ? 'approved' : 'rejected',
          decidedBy: scope.userId,
          decidedAt: now.toISOString(),
          note: body.note?.trim() || null,
        },
      };
      if (body.approve) action.postAction = null;
      return toActionView(
        await manager.getRepository(RcaAction).save(action),
        now,
      );
    });
  }
}

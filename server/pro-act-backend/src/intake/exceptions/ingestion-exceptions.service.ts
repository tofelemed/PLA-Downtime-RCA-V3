import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { IngestionException } from '../entities/ingestion-exception.entity';
import { ReplayRun } from '../entities/replay-run.entity';
import { ReplayService } from '../replay/replay.service';

export type ExceptionResolution =
  | { kind: 'replay'; run: ReplayRun }
  | { kind: 'irrecoverable'; exception: IngestionException };

/**
 * Quarantine commands (spec ING05): resolve by replay (a replay run scoped to the exception's source
 * object; the run resolves the row once the object normalises) or close as irrecoverable (kept, never
 * deleted). Only open exceptions can be resolved (409 otherwise).
 */
@Injectable()
export class IngestionExceptionsService {
  constructor(
    @InjectRepository(IngestionException)
    private readonly exceptions: Repository<IngestionException>,
    private readonly replays: ReplayService,
  ) {}

  async get(context: RequestContext, id: string): Promise<IngestionException> {
    const found = await this.exceptions.findOneBy({
      id,
      tenantId: requireTenantId(context),
    });
    if (found) return found;
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Ingestion exception not found',
    });
  }

  async resolve(
    context: RequestContext,
    id: string,
    input: { action: 'replay' | 'irrecoverable'; reason: string },
  ): Promise<ExceptionResolution> {
    const exception = await this.get(context, id);
    if (exception.state !== 'open') {
      throw new ConflictException({
        code: 'EXCEPTION_NOT_OPEN',
        message: `The exception is already ${exception.state}`,
      });
    }
    if (input.action === 'replay') {
      const run = await this.replays.request(context, exception.connectionId, {
        exceptionIds: [exception.id],
        reason: input.reason,
      });
      await this.exceptions.update(exception.id, { replayRunId: run.id });
      return { kind: 'replay', run };
    }
    Object.assign(exception, {
      state: 'irrecoverable',
      ownerId: context.userId,
      resolution: {
        action: 'irrecoverable',
        reason: input.reason,
        by: context.userId,
        at: new Date().toISOString(),
      },
      updatedBy: context.userId,
    });
    return {
      kind: 'irrecoverable',
      exception: await this.exceptions.save(exception),
    };
  }
}

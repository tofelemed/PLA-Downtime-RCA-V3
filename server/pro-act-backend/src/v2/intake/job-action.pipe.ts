import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { JOB_ACTIONS, JobAction } from '../../intake/jobs/job-transitions';

/** `/ingestion-jobs/{id}/{action}`: an unknown action is an unknown route (404). */
@Injectable()
export class JobActionPipe implements PipeTransform<string, JobAction> {
  transform(value: string): JobAction {
    if ((JOB_ACTIONS as readonly string[]).includes(value)) {
      return value as JobAction;
    }
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: `Unknown job action "${value}" (one of ${JOB_ACTIONS.join(', ')})`,
    });
  }
}

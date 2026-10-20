import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { EVENT_WRITERS } from '../production-events/event-write-roles';
import { CreateShiftNoteDto } from './ops-reports-v2.dto';
import { OpsReportsV2Service } from './ops-reports-v2.service';
import { ShiftNoteView } from './shift-notes';

/** Shift handover notes (report R2): append-only free text of the outgoing shift. */
@ApiTags('v2 · Operating reports')
@ApiBearerAuth()
@Controller({ path: 'shift-notes', version: '2' })
export class ShiftNotesV2Controller {
  constructor(private readonly reports: OpsReportsV2Service) {}

  @Post()
  @Roles(...EVENT_WRITERS)
  @ApiOperation({
    summary: 'Leave a handover note for a unit’s shift (append-only)',
    description:
      'Roles that record events. unitId must be a unit of the tenant and the caller’s scope (422 ' +
      'INVALID_REFERENCE); a blank body is 422 INVALID_NOTE. Notes are never edited or deleted: a ' +
      'correction is a new note.',
  })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateShiftNoteDto,
  ): Promise<ShiftNoteView> {
    return this.reports.createShiftNote(ctx, body);
  }
}

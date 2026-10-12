import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Ctx } from '../../../common/context/ctx.decorator';
import { RequestContext } from '../../../common/context/request-context';
import { Idempotent } from '../../../common/idempotency/idempotent.decorator';
import { ListResponse } from '../../common/response';
import { TenantQueryParamGuard } from '../../common/tenant-query-param.guard';
import {
  CreateTaskV2Dto,
  TaskFiltersDto,
  TasksListQueryDto,
  UpdateTaskV2Dto,
} from './tasks-v2.dto';
import { TasksV2CommandsService } from './tasks-v2-commands.service';
import { TasksV2Service } from './tasks-v2.service';
import { TaskSummaryView, TaskV2View } from './task-v2.view';

/**
 * Action items of the acting plant (owner requirement "v2 only": replaces the v1 `/tasks` page). Every
 * member reads them; every member who may write (not a viewer, `READ_ONLY_ROLE`) creates and updates them.
 */
@ApiTags('v2 · Tasks')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'tasks', version: '2' })
export class TasksV2Controller {
  constructor(
    private readonly reads: TasksV2Service,
    private readonly commands: TasksV2CommandsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Tasks of the acting plant (keyset; earliest due first by default)',
    description:
      'Filters: statuses, priorities, assignedToMe or assigneeId, linkType + linkId, q (title, description), ' +
      'overdue, from/to on the due date (half-open). Names are resolved on the server.',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Query() query: TasksListQueryDto,
  ): Promise<ListResponse<TaskV2View>> {
    return this.reads.list(ctx, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Counts by status and overdue of the filtered tasks',
  })
  @ApiOkResponse({ type: TaskSummaryView })
  summary(
    @Ctx() ctx: RequestContext,
    @Query() query: TaskFiltersDto,
  ): Promise<TaskSummaryView> {
    return this.reads.summary(ctx, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One task of the acting plant (404 otherwise)' })
  get(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TaskV2View> {
    return this.reads.get(ctx, id);
  }

  @Post()
  @Idempotent()
  @ApiOperation({
    summary: 'Create a task (requires Idempotency-Key)',
    description:
      '422 INVALID_ASSIGNEE when the assignee is not an active member of the plant.',
  })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateTaskV2Dto,
  ): Promise<TaskV2View> {
    return this.commands.create(ctx, body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Change a task',
    description:
      'Leaving Completed clears the completion time; linkType null removes the link.',
  })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTaskV2Dto,
  ): Promise<TaskV2View> {
    return this.commands.update(ctx, id, body);
  }

  @Post(':id/complete')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a task completed (requires Idempotency-Key)' })
  complete(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TaskV2View> {
    return this.commands.complete(ctx, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.commands.remove(ctx, id);
  }
}

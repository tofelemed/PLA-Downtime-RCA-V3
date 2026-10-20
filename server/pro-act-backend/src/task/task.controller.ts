import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from './task.entity';
import {
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { TenantBound } from '../auth/decorators/tenant-bound.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Ctx } from '../common/context/ctx.decorator';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';

/**
 * v1 tasks, kept for the demo seeders, the API audit script and e2e (the app uses `/v2/tasks`). Plan 1.6
 * hardening: a list without `tenantId` is the acting tenant's, and by-id routes answer 404 outside the
 * acting tenant instead of relying on row-level security alone.
 */
@ApiTags('Tasks')
@ApiBearerAuth()
@TenantBound()
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'List tasks with combined filters',
    type: [Task],
  })
  @ApiQuery({ name: 'assignedTo', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'overdue', required: false })
  findAll(
    @Ctx() ctx: RequestContext,
    @Query('assignedTo') assignedTo?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tenantId') tenantId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('overdue') overdue?: string,
  ): Promise<Task[]> {
    // a named tenant was already checked by `@TenantBound()` (acting tenant or one within scope)
    return this.taskService.findWithFilters({
      assignedTo,
      status,
      priority,
      tenantId: tenantId || requireTenantId(ctx),
      entityType,
      entityId,
      overdue: overdue === 'true',
    });
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get task by ID', type: Task })
  findOne(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Task> {
    return this.taskService.findInTenant(requireTenantId(ctx), id);
  }

  @Post()
  @ApiBody({ type: CreateTaskDto })
  @ApiResponse({ status: 201, description: 'Create task', type: Task })
  create(@Body() data: CreateTaskDto): Promise<Task> {
    const payload = this.transformDateFields(data);
    return this.taskService.create(payload);
  }

  @Put(':id')
  @ApiBody({ type: UpdateTaskDto })
  @ApiResponse({ status: 200, description: 'Update task', type: Task })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() data: UpdateTaskDto,
  ): Promise<Task | null> {
    const payload = this.transformDateFields(data);
    return this.taskService.update(requireTenantId(ctx), id, payload);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete task' })
  remove(
    @Ctx() ctx: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.taskService.remove(requireTenantId(ctx), id);
  }

  private transformDateFields<
    T extends Partial<CreateTaskDto> | Partial<UpdateTaskDto>,
  >(data: T): Partial<Task> {
    const transformed: Record<string, unknown> = { ...data };
    const dateFields: (keyof T)[] = ['dueDate', 'completedDate'];
    for (const field of dateFields) {
      const value = transformed[field as string];
      if (typeof value === 'string') {
        transformed[field as string] = value ? new Date(value) : undefined;
      }
    }
    return transformed;
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
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
import { findOrThrow } from '../common/helpers/find-or-throw';

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
    @Query('assignedTo') assignedTo?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tenantId') tenantId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('overdue') overdue?: string,
  ): Promise<Task[]> {
    const hasFilters =
      assignedTo ||
      status ||
      priority ||
      tenantId ||
      entityType ||
      entityId ||
      overdue === 'true';
    if (!hasFilters) {
      return this.taskService.findAll();
    }
    return this.taskService.findWithFilters({
      assignedTo,
      status,
      priority,
      tenantId,
      entityType,
      entityId,
      overdue: overdue === 'true',
    });
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get task by ID', type: Task })
  findOne(@Param('id') id: string): Promise<Task> {
    return findOrThrow(this.taskService.findOne(id), 'Task', id);
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
    @Param('id') id: string,
    @Body() data: UpdateTaskDto,
  ): Promise<Task | null> {
    const payload = this.transformDateFields(data);
    return this.taskService.update(id, payload);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete task' })
  remove(@Param('id') id: string): Promise<void> {
    return this.taskService.remove(id);
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

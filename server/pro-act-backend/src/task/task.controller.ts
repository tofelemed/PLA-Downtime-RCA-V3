import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from './task.entity';
import { ApiTags, ApiBearerAuth, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all tasks', type: [Task] })
  @ApiQuery({ name: 'assignedTo', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'overdue', required: false })
  findAll(
    @Query('assignedTo') assignedTo?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tenantId') tenantId?: string,
    @Query('overdue') overdue?: string,
  ): Promise<Task[]> {
    if (overdue === 'true') {
      return this.taskService.findOverdue();
    }
    if (assignedTo) {
      return this.taskService.findByAssignedTo(assignedTo);
    }
    if (status) {
      return this.taskService.findByStatus(status);
    }
    if (priority) {
      return this.taskService.findByPriority(priority);
    }
    if (tenantId) {
      return this.taskService.findByTenant(tenantId);
    }
    return this.taskService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get task by ID', type: Task })
  findOne(@Param('id') id: string): Promise<Task | null> {
    return this.taskService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateTaskDto })
  @ApiResponse({ status: 201, description: 'Create task', type: Task })
  create(@Body() data: CreateTaskDto): Promise<Task> {
    return this.taskService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: CreateTaskDto })
  @ApiResponse({ status: 200, description: 'Update task', type: Task })
  update(@Param('id') id: string, @Body() data: CreateTaskDto): Promise<Task | null> {
    return this.taskService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete task' })
  remove(@Param('id') id: string): Promise<void> {
    return this.taskService.remove(id);
  }
} 
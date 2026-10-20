import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Task } from './task.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { findOrThrow } from '../common/helpers/find-or-throw';

export interface TaskQuery {
  assignedTo?: string;
  status?: string;
  priority?: string;
  tenantId?: string;
  entityType?: string;
  entityId?: string;
  overdue?: boolean;
}

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findWithFilters(filters: TaskQuery): Promise<Task[]> {
    const qb = this.taskRepository.createQueryBuilder('task');

    if (filters.tenantId) {
      qb.andWhere('task.tenantId = :tenantId', { tenantId: filters.tenantId });
    }
    if (filters.assignedTo) {
      qb.andWhere('task.assignedTo = :assignedTo', {
        assignedTo: filters.assignedTo,
      });
    }
    if (filters.status) {
      qb.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters.priority) {
      qb.andWhere('task.priority = :priority', { priority: filters.priority });
    }
    if (filters.entityType) {
      qb.andWhere('task.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }
    if (filters.entityId) {
      qb.andWhere('task.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.overdue) {
      qb.andWhere('task.dueDate < :now', { now: new Date() });
      qb.andWhere('task.status != :completed', { completed: 'Completed' });
    }

    return qb
      .orderBy('task.dueDate', 'ASC')
      .addOrderBy('task.createdAt', 'DESC')
      .getMany();
  }

  /** The task in `tenantId`; a task of another tenant reads as absent (plan 1.6: not RLS alone). */
  findOne(tenantId: string, id: string): Promise<Task | null> {
    return this.taskRepository.findOne({ where: { id, tenantId } });
  }

  /** The task in `tenantId`, or 404. */
  findInTenant(tenantId: string, id: string): Promise<Task> {
    return findOrThrow(this.findOne(tenantId, id), 'Task', id);
  }

  async create(data: Partial<Task>): Promise<Task> {
    const task = this.taskRepository.create({
      id: data.id ?? randomUUID(),
      ...data,
      completedDate:
        data.status === 'Completed'
          ? (data.completedDate ?? new Date())
          : data.completedDate,
    });
    const saved = await this.taskRepository.save(task);
    this.realtimeGateway.broadcastEntityEvent('Created', 'task', saved);
    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<Task>,
  ): Promise<Task | null> {
    const patch = { ...data };
    if (patch.status === 'Completed' && !patch.completedDate) {
      patch.completedDate = new Date();
    }
    if (patch.status && patch.status !== 'Completed') {
      patch.completedDate = undefined;
    }
    await this.findInTenant(tenantId, id);
    await this.taskRepository.update({ id, tenantId }, patch);
    const updated = await this.findInTenant(tenantId, id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'task', updated);
    return updated;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findInTenant(tenantId, id);
    await this.taskRepository.delete({ id, tenantId });
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'task', { id });
  }

  findByAssignedTo(assignedTo: string): Promise<Task[]> {
    return this.findWithFilters({ assignedTo });
  }

  findByStatus(status: string): Promise<Task[]> {
    return this.findWithFilters({ status });
  }

  findByPriority(priority: string): Promise<Task[]> {
    return this.findWithFilters({ priority });
  }

  findByTenant(tenantId: string): Promise<Task[]> {
    return this.findWithFilters({ tenantId });
  }

  findByEntity(entityType: string, entityId: string): Promise<Task[]> {
    return this.findWithFilters({ entityType, entityId });
  }

  findOverdue(tenantId?: string): Promise<Task[]> {
    return this.findWithFilters({ overdue: true, tenantId });
  }
}

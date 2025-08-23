import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<Task[]> {
    return this.taskRepository.find({
      relations: ['assignedToUser', 'assignedByUser', 'organization', 'tenant'],
    });
  }

  findOne(id: string): Promise<Task | null> {
    return this.taskRepository.findOne({
      where: { id },
      relations: ['assignedToUser', 'assignedByUser', 'organization', 'tenant'],
    });
  }

  async create(data: Partial<Task>): Promise<Task> {
    const task = this.taskRepository.create(data);
    const saved = await this.taskRepository.save(task);
    this.realtimeGateway.broadcastEntityEvent('Created', 'task', saved);
    return saved;
  }

  async update(id: string, data: Partial<Task>): Promise<Task | null> {
    await this.taskRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'task', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.taskRepository.delete(id);
    if (task) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'task', { id });
    }
  }

  findByAssignedTo(assignedTo: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { assignedTo },
      relations: ['assignedToUser', 'assignedByUser', 'organization', 'tenant'],
    });
  }

  findByStatus(status: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { status },
      relations: ['assignedToUser', 'assignedByUser', 'organization', 'tenant'],
    });
  }

  findByPriority(priority: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { priority },
      relations: ['assignedToUser', 'assignedByUser', 'organization', 'tenant'],
    });
  }

  findByTenant(tenantId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { tenantId },
      relations: ['assignedToUser', 'assignedByUser', 'organization', 'tenant'],
    });
  }

  findOverdue(): Promise<Task[]> {
    const now = new Date();
    return this.taskRepository.find({
      where: {
        dueDate: { $lt: now } as any,
        status: { $ne: 'Completed' } as any,
      },
      relations: ['assignedToUser', 'assignedByUser', 'organization', 'tenant'],
    });
  }
} 
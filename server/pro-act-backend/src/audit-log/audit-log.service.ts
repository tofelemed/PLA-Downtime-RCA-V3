import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<AuditLog[]> {
    return this.auditLogRepository.find();
  }

  findOne(id: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findOneBy({ id });
  }

  async create(data: Partial<AuditLog>): Promise<AuditLog> {
    const log = this.auditLogRepository.create(data);
    const saved = await this.auditLogRepository.save(log);
    this.realtimeGateway.broadcastEntityEvent('Created', 'auditLog', saved);
    return saved;
  }

  async update(id: string, data: Partial<AuditLog>): Promise<AuditLog | null> {
    await this.auditLogRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'auditLog', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const log = await this.findOne(id);
    await this.auditLogRepository.delete(id);
    if (log) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'auditLog', { id });
    }
  }
} 
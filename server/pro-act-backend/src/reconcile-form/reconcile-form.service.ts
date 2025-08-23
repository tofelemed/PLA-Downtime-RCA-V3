import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReconcileForm } from './reconcile-form.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class ReconcileFormService {
  constructor(
    @InjectRepository(ReconcileForm)
    private readonly formRepository: Repository<ReconcileForm>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<ReconcileForm[]> {
    return this.formRepository.find({ relations: ['loss', 'tenant'] });
  }

  findOne(id: string): Promise<ReconcileForm | null> {
    return this.formRepository.findOne({ where: { id }, relations: ['loss', 'tenant'] });
  }

  async create(data: Partial<ReconcileForm>): Promise<ReconcileForm> {
    const form = this.formRepository.create(data);
    const saved = await this.formRepository.save(form);
    this.realtimeGateway.broadcastEntityEvent('Created', 'reconcileForm', saved);
    return saved;
  }

  async update(id: string, data: Partial<ReconcileForm>): Promise<ReconcileForm | null> {
    await this.formRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'reconcileForm', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const form = await this.findOne(id);
    await this.formRepository.delete(id);
    if (form) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'reconcileForm', { id });
    }
  }

  findByLoss(lossId: string): Promise<ReconcileForm[]> {
    return this.formRepository.find({ where: { lossId }, relations: ['loss', 'tenant'] });
  }

  findByTenant(tenantId: string): Promise<ReconcileForm[]> {
    return this.formRepository.find({ where: { tenantId }, relations: ['loss', 'tenant'] });
  }
} 
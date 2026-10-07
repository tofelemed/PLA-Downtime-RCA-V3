import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Unit } from './unit.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class UnitService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<Unit[]> {
    return this.unitRepository.find();
  }

  findOne(id: string): Promise<Unit | null> {
    return this.unitRepository.findOneBy({ id });
  }

  async create(data: Partial<Unit>): Promise<Unit> {
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const unit = this.unitRepository.create({ id, ...data });
    const saved = await this.unitRepository.save(unit);
    this.realtimeGateway.broadcastEntityEvent('Created', 'unit', saved);
    return saved;
  }

  async update(id: string, data: Partial<Unit>): Promise<Unit | null> {
    await this.unitRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'unit', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const unit = await this.findOne(id);
    await this.unitRepository.delete(id);
    if (unit) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'unit', { id });
    }
  }
} 
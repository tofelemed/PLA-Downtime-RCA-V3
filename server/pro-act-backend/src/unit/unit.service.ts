import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Unit } from './unit.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { findOrThrow } from '../common/helpers/find-or-throw';

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
    await findOrThrow(this.findOne(id), 'Unit', id);
    await this.unitRepository.update(id, data);
    const updated = await findOrThrow(this.findOne(id), 'Unit', id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'unit', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'Unit', id);
    await this.unitRepository.delete(id);
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'unit', { id });
  }
} 
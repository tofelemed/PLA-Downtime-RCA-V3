import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RCA } from './rca.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class RCAService {
  constructor(
    @InjectRepository(RCA)
    private readonly rcaRepository: Repository<RCA>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<RCA[]> {
    return this.rcaRepository.find({
      relations: ['event', 'teamLead', 'template'],
    });
  }

  findOne(id: string): Promise<RCA | null> {
    return this.rcaRepository.findOne({
      where: { id },
      relations: ['event', 'teamLead', 'template'],
    });
  }

  async create(data: Partial<RCA>): Promise<RCA> {
    const rca = this.rcaRepository.create(data);
    const saved = await this.rcaRepository.save(rca);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rca', saved);
    return saved;
  }

  async update(id: string, data: Partial<RCA>): Promise<RCA | null> {
    await this.rcaRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'rca', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const rca = await this.findOne(id);
    await this.rcaRepository.delete(id);
    if (rca) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'rca', { id });
    }
  }

  findByStatus(status: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { status },
      relations: ['event', 'teamLead', 'template'],
    });
  }

  findByPriority(priority: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { priority },
      relations: ['event', 'teamLead', 'template'],
    });
  }

  findByTeamLead(teamLeadId: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { teamLeadId },
      relations: ['event', 'teamLead', 'template'],
    });
  }

  findByEvent(eventId: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { eventId },
      relations: ['event', 'teamLead', 'template'],
    });
  }
} 
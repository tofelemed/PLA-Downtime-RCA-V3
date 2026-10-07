import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { RCA } from './rca.entity';
import { RealtimeGateway } from '../realtime.gateway';

function normalizeRcaPayload(data: Partial<RCA>): Partial<RCA> {
  const payload = { ...data };
  if (Array.isArray(payload.teamMemberIds)) {
    payload.teamMemberIds = JSON.stringify(payload.teamMemberIds) as unknown as string[];
  }
  if (Array.isArray(payload.recommendations)) {
    payload.recommendations = JSON.stringify(payload.recommendations);
  }
  if (Array.isArray(payload.evidence)) {
    payload.evidence = JSON.stringify(payload.evidence);
  }
  return payload;
}

@Injectable()
export class RCAService {
  constructor(
    @InjectRepository(RCA)
    private readonly rcaRepository: Repository<RCA>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<RCA[]> {
    return this.rcaRepository.find({
      // Removed 'event' relation temporarily - it has fields that don't exist in DB
      relations: ['teamLead', 'template'],
    });
  }

  findOne(id: string): Promise<RCA | null> {
    return this.rcaRepository.findOne({
      where: { id },
      // Removed 'event' relation temporarily - it has fields that don't exist in DB
      relations: ['teamLead', 'template'],
    });
  }

  async create(data: Partial<RCA>): Promise<RCA> {
    const payload = normalizeRcaPayload({
      id: data.id ?? randomUUID(),
      ...data,
    });
    const rca = this.rcaRepository.create(payload);
    const saved = await this.rcaRepository.save(rca);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rca', saved);
    return saved;
  }

  async update(id: string, data: Partial<RCA>): Promise<RCA | null> {
    await this.rcaRepository.update(id, normalizeRcaPayload(data));
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
      relations: ['teamLead', 'template'], // Removed 'event' relation
    });
  }

  findByPriority(priority: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { priority },
      relations: ['teamLead', 'template'], // Removed 'event' relation
    });
  }

  findByTeamLead(teamLeadId: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { teamLeadId },
      relations: ['teamLead', 'template'], // Removed 'event' relation
    });
  }

  findByEvent(eventId: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { eventId },
      relations: ['teamLead', 'template'], // Removed 'event' relation
    });
  }

  findByTenant(tenantId: string): Promise<RCA[]> {
    return this.rcaRepository.find({
      where: { tenantId },
      relations: ['teamLead', 'template'], // Removed 'event' relation
    });
  }
} 
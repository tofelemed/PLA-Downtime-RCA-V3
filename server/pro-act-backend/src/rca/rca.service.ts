import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { RCA } from './rca.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { findOrThrow } from '../common/helpers/find-or-throw';
import { assertV1CreateStatus, assertV1Update } from './v1-workflow-guard';

/** v1 body: arrays of the JSON text columns are serialized (3.9: the DTO accepts text or arrays). */
export type RcaWriteBody = Omit<
  Partial<RCA>,
  'recommendations' | 'evidence' | 'logicTree'
> & {
  recommendations?: string | unknown[];
  evidence?: string | unknown[];
  logicTree?: string | unknown[];
};

const jsonText = (value: string | unknown[] | undefined) =>
  Array.isArray(value) ? JSON.stringify(value) : value;

function normalizeRcaPayload(data: RcaWriteBody): Partial<RCA> {
  const payload: Partial<RCA> = {
    ...data,
    recommendations: jsonText(data.recommendations),
    evidence: jsonText(data.evidence),
    logicTree: jsonText(data.logicTree),
  };
  if (Array.isArray(payload.teamMemberIds)) {
    payload.teamMemberIds = JSON.stringify(
      payload.teamMemberIds,
    ) as unknown as string[];
  }
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Partial<RCA>;
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

  async create(data: RcaWriteBody): Promise<RCA> {
    assertV1CreateStatus(data.status);
    const payload = normalizeRcaPayload({
      id: data.id ?? randomUUID(),
      ...data,
    });
    const rca = this.rcaRepository.create(payload);
    const saved = await this.rcaRepository.save(rca);
    this.realtimeGateway.broadcastEntityEvent('Created', 'rca', saved);
    return saved;
  }

  async update(id: string, data: RcaWriteBody): Promise<RCA | null> {
    // v1 writes move row_version too, so a v2 If-Match sees them (plan 3.9)
    const stored = await findOrThrow(this.findOne(id), 'RCA', id);
    assertV1Update(stored, data);
    await this.rcaRepository.update(id, {
      ...normalizeRcaPayload(data),
      rowVersion: () => '"row_version" + 1',
    });
    const updated = await findOrThrow(this.findOne(id), 'RCA', id);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'rca', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await findOrThrow(this.findOne(id), 'RCA', id);
    await this.rcaRepository.delete(id);
    this.realtimeGateway.broadcastEntityEvent('Deleted', 'rca', { id });
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

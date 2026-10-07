import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { DashboardConfiguration } from './dashboard-configuration.entity';
import { RealtimeGateway } from '../realtime.gateway';
import {
  DashboardConfigApiPayload,
  DashboardConfigApiRecord,
  fromApiPayload,
  toApiRecord,
} from './dashboard-configuration.mapper';

@Injectable()
export class DashboardConfigurationService {
  constructor(
    @InjectRepository(DashboardConfiguration)
    private readonly configRepository: Repository<DashboardConfiguration>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private mapList(entities: DashboardConfiguration[]): DashboardConfigApiRecord[] {
    return entities.map(toApiRecord);
  }

  findAll(): Promise<DashboardConfigApiRecord[]> {
    return this.configRepository.find().then((rows) => this.mapList(rows));
  }

  findOne(id: string): Promise<DashboardConfigApiRecord | null> {
    return this.configRepository.findOne({ where: { id } }).then((row) => (row ? toApiRecord(row) : null));
  }

  async create(data: DashboardConfigApiPayload): Promise<DashboardConfigApiRecord> {
    const mapped = fromApiPayload(data);
    const config = this.configRepository.create({
      id: randomUUID(),
      ...mapped,
    });
    const saved = await this.configRepository.save(config);
    const record = toApiRecord(saved);
    this.realtimeGateway.broadcastEntityEvent('Created', 'dashboardConfiguration', record);
    return record;
  }

  async update(id: string, data: DashboardConfigApiPayload): Promise<DashboardConfigApiRecord | null> {
    const mapped = fromApiPayload(data);
    await this.configRepository.update(id, mapped);
    const updated = await this.configRepository.findOne({ where: { id } });
    if (!updated) return null;
    const record = toApiRecord(updated);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'dashboardConfiguration', record);
    return record;
  }

  async remove(id: string): Promise<void> {
    const config = await this.configRepository.findOne({ where: { id } });
    await this.configRepository.delete(id);
    if (config) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'dashboardConfiguration', { id });
    }
  }

  findByTenant(tenantId: string): Promise<DashboardConfigApiRecord[]> {
    return this.configRepository.find({ where: { tenantId } }).then((rows) => this.mapList(rows));
  }

  findActiveByTenant(tenantId: string): Promise<DashboardConfigApiRecord | null> {
    return this.configRepository
      .findOne({ where: { tenantId, isDefault: true } })
      .then((row) => (row ? toApiRecord(row) : null));
  }

  findByVersion(_tenantId: string, _version: number): Promise<DashboardConfigApiRecord | null> {
    return Promise.resolve(null);
  }

  async deactivateAll(tenantId: string): Promise<void> {
    await this.configRepository.update({ tenantId }, { isDefault: false });
  }
}

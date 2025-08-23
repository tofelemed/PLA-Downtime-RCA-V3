import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardConfiguration } from './dashboard-configuration.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class DashboardConfigurationService {
  constructor(
    @InjectRepository(DashboardConfiguration)
    private readonly configRepository: Repository<DashboardConfiguration>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<DashboardConfiguration[]> {
    return this.configRepository.find({
      relations: ['tenant'],
    });
  }

  findOne(id: string): Promise<DashboardConfiguration | null> {
    return this.configRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
  }

  async create(data: Partial<DashboardConfiguration>): Promise<DashboardConfiguration> {
    const config = this.configRepository.create(data);
    const saved = await this.configRepository.save(config);
    this.realtimeGateway.broadcastEntityEvent('Created', 'dashboardConfiguration', saved);
    return saved;
  }

  async update(id: string, data: Partial<DashboardConfiguration>): Promise<DashboardConfiguration | null> {
    await this.configRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'dashboardConfiguration', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const config = await this.findOne(id);
    await this.configRepository.delete(id);
    if (config) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'dashboardConfiguration', { id });
    }
  }

  findByTenant(tenantId: string): Promise<DashboardConfiguration[]> {
    return this.configRepository.find({
      where: { tenantId },
      relations: ['tenant'],
    });
  }

  findActiveByTenant(tenantId: string): Promise<DashboardConfiguration | null> {
    return this.configRepository.findOne({
      where: { tenantId, isActive: true },
      relations: ['tenant'],
    });
  }

  findByVersion(tenantId: string, version: number): Promise<DashboardConfiguration | null> {
    return this.configRepository.findOne({
      where: { tenantId, version },
      relations: ['tenant'],
    });
  }

  async deactivateAll(tenantId: string): Promise<void> {
    await this.configRepository.update(
      { tenantId },
      { isActive: false }
    );
  }
} 
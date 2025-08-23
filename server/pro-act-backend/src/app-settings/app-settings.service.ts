import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './app-settings.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly settingsRepository: Repository<AppSettings>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<AppSettings[]> {
    return this.settingsRepository.find();
  }

  findOne(key: string): Promise<AppSettings | null> {
    return this.settingsRepository.findOneBy({ key });
  }

  async create(data: Partial<AppSettings>): Promise<AppSettings> {
    const setting = this.settingsRepository.create(data);
    const saved = await this.settingsRepository.save(setting);
    this.realtimeGateway.broadcastEntityEvent('Created', 'appSettings', saved);
    return saved;
  }

  async update(key: string, data: Partial<AppSettings>): Promise<AppSettings | null> {
    await this.settingsRepository.update(key, data);
    const updated = await this.findOne(key);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'appSettings', updated);
    }
    return updated;
  }

  async remove(key: string): Promise<void> {
    const setting = await this.findOne(key);
    await this.settingsRepository.delete(key);
    if (setting) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'appSettings', { key });
    }
  }

  async upsert(key: string, value: any): Promise<AppSettings> {
    const existing = await this.findOne(key);
    if (existing) {
      await this.update(key, { value });
      return this.findOne(key) as Promise<AppSettings>;
    } else {
      return this.create({ key, value });
    }
  }

  async getValue(key: string, defaultValue?: any): Promise<any> {
    const setting = await this.findOne(key);
    return setting ? setting.value : defaultValue;
  }

  async setValue(key: string, value: any): Promise<AppSettings> {
    return this.upsert(key, value);
  }
} 
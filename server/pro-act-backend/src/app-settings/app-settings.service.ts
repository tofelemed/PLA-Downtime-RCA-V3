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
    // Serialize value to JSON string if it's an object/array
    const serializedData = {
      ...data,
      value: typeof data.value === 'string' ? data.value : JSON.stringify(data.value),
    };
    const setting = this.settingsRepository.create(serializedData);
    const saved = await this.settingsRepository.save(setting);
    this.realtimeGateway.broadcastEntityEvent('Created', 'appSettings', saved);
    return saved;
  }

  async update(key: string, data: Partial<AppSettings>): Promise<AppSettings | null> {
    // Serialize value to JSON string if it's an object/array
    const updateData: any = {};
    if (data.value !== undefined) {
      updateData.value = typeof data.value === 'string' 
        ? data.value 
        : JSON.stringify(data.value);
    }
    
    // Only update if there's something to update
    if (Object.keys(updateData).length > 0) {
      await this.settingsRepository.update(key, updateData);
    }
    
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
    if (!setting) return defaultValue;
    
    // Try to parse as JSON, fallback to string if it's not valid JSON
    try {
      return JSON.parse(setting.value);
    } catch {
      return setting.value;
    }
  }

  async setValue(key: string, value: any): Promise<AppSettings> {
    return this.upsert(key, value);
  }
} 
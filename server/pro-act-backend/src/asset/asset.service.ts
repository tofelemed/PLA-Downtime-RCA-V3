import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './asset.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<Asset[]> {
    return this.assetRepository.find();
  }

  findOne(id: string): Promise<Asset | null> {
    return this.assetRepository.findOneBy({ id });
  }

  async create(data: Partial<Asset>): Promise<Asset> {
    const asset = this.assetRepository.create(data);
    const saved = await this.assetRepository.save(asset);
    this.realtimeGateway.broadcastEntityEvent('Created', 'asset', saved);
    return saved;
  }

  async update(id: string, data: Partial<Asset>): Promise<Asset | null> {
    await this.assetRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'asset', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const asset = await this.findOne(id);
    await this.assetRepository.delete(id);
    if (asset) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'asset', { id });
    }
  }
} 
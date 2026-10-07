import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Product } from './product.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<Product[]> {
    return this.productRepository.find();
  }

  findOne(id: string): Promise<Product | null> {
    return this.productRepository.findOneBy({ id });
  }

  async create(data: Partial<Product>): Promise<Product> {
    const id = randomUUID();
    const product = this.productRepository.create({ id, ...data });
    const saved = await this.productRepository.save(product);
    this.realtimeGateway.broadcastEntityEvent('Created', 'product', saved);
    return saved;
  }

  async update(id: string, data: Partial<Product>): Promise<Product | null> {
    await this.productRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'product', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.delete(id);
    if (product) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'product', { id });
    }
  }
} 
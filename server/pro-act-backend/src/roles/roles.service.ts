import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Role } from './role.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find();
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(data: Partial<Role>): Promise<Role> {
    const role = this.rolesRepository.create({
      id: data.id ?? randomUUID(),
      ...data,
    });
    const saved = await this.rolesRepository.save(role);
    this.realtimeGateway.broadcastEntityEvent('Created', 'role', saved);
    return saved;
  }

  async update(id: string, data: Partial<Role>): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, data);
    const saved = await this.rolesRepository.save(role);
    this.realtimeGateway.broadcastEntityEvent('Updated', 'role', saved);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    await this.rolesRepository.remove(role);
    if (role) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'role', { id });
    }
  }
} 
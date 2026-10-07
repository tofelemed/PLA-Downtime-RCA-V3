import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async findByEmail(email: string): Promise<User | undefined> {
    // Postgres compares case-sensitively (MSSQL's default collation did not)
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
    return user ?? undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await this.usersRepository.findOne({ where: { id } });
    return user ?? undefined;
  }

  async findOne(id: string): Promise<User | undefined> {
    return this.findById(id);
  }

  async findAll(filters: { tenantId?: string; organizationId?: string; isActive?: boolean } = {}): Promise<User[]> {
    const where: FindOptionsWhere<User> = {};

    if (filters.tenantId) {
      where.tenantId = filters.tenantId;
    }

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (Object.keys(where).length === 0) {
      return this.usersRepository.find();
    }

    return this.usersRepository.find({ where });
  }

  async create(user: CreateUserDto): Promise<User> {
    const { password, ...rest } = user;
    // Hash the password before storing
    const passwordHash = await bcrypt.hash(password, 10);
    // Generate UUID manually for SQL Server compatibility
    const id = randomUUID();
    const newUser = this.usersRepository.create({
      id,
      ...rest,
      passwordHash,
      isActive: rest.isActive ?? true,
    });
    const saved = await this.usersRepository.save(newUser);
    this.realtimeGateway.broadcastEntityEvent('Created', 'user', saved);
    return saved;
  }

  async update(id: string, data: UpdateUserDto): Promise<User | undefined> {
    const { password, ...rest } = data;
    const updatePayload: Partial<User> = {
      ...rest,
    };
    
    // Hash password if provided
    if (password) {
      updatePayload.passwordHash = await bcrypt.hash(password, 10);
    }

    await this.usersRepository.update(id, updatePayload);
    const updated = await this.findById(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'user', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (user) {
      await this.usersRepository.delete(id);
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'user', { id });
    }
  }
} 
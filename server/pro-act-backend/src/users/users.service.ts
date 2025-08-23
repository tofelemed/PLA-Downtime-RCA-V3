import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.usersRepository.findOne({ where: { email } });
    return user ?? undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await this.usersRepository.findOne({ where: { id } });
    return user ?? undefined;
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.usersRepository.create(user);
    const saved = await this.usersRepository.save(newUser);
    this.realtimeGateway.broadcastEntityEvent('Created', 'user', saved);
    return saved;
  }

  async update(id: string, data: Partial<User>): Promise<User | undefined> {
    await this.usersRepository.update(id, data);
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
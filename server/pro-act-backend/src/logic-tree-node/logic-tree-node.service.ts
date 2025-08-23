import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogicTreeNode } from './logic-tree-node.entity';
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class LogicTreeNodeService {
  constructor(
    @InjectRepository(LogicTreeNode)
    private readonly nodeRepository: Repository<LogicTreeNode>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  findAll(): Promise<LogicTreeNode[]> {
    return this.nodeRepository.find({
      relations: ['rca', 'parent', 'children'],
    });
  }

  findOne(id: string): Promise<LogicTreeNode | null> {
    return this.nodeRepository.findOne({
      where: { id },
      relations: ['rca', 'parent', 'children'],
    });
  }

  async create(data: Partial<LogicTreeNode>): Promise<LogicTreeNode> {
    const node = this.nodeRepository.create(data);
    const saved = await this.nodeRepository.save(node);
    this.realtimeGateway.broadcastEntityEvent('Created', 'logicTreeNode', saved);
    return saved;
  }

  async update(id: string, data: Partial<LogicTreeNode>): Promise<LogicTreeNode | null> {
    await this.nodeRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'logicTreeNode', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const node = await this.findOne(id);
    await this.nodeRepository.delete(id);
    if (node) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'logicTreeNode', { id });
    }
  }

  findByRCA(rcaId: string): Promise<LogicTreeNode[]> {
    return this.nodeRepository.find({
      where: { rcaId },
      relations: ['rca', 'parent', 'children'],
    });
  }

  findByParent(parentId: string): Promise<LogicTreeNode[]> {
    return this.nodeRepository.find({
      where: { parentId },
      relations: ['rca', 'parent', 'children'],
    });
  }

  findRootNodes(rcaId: string): Promise<LogicTreeNode[]> {
    return this.nodeRepository.find({
      where: { rcaId, parentId: null as any },
      relations: ['rca', 'parent', 'children'],
    });
  }

  findByType(rcaId: string, type: string): Promise<LogicTreeNode[]> {
    return this.nodeRepository.find({
      where: { rcaId, type },
      relations: ['rca', 'parent', 'children'],
    });
  }

  findVerified(rcaId: string): Promise<LogicTreeNode[]> {
    return this.nodeRepository.find({
      where: { rcaId, verified: true },
      relations: ['rca', 'parent', 'children'],
    });
  }
} 
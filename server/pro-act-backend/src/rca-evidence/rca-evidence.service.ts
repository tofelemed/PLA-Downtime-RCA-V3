import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RCAEvidence } from './rca-evidence.entity';

@Injectable()
export class RCAEvidenceService {
  constructor(
    @InjectRepository(RCAEvidence)
    private readonly evidenceRepository: Repository<RCAEvidence>,
  ) {}

  findAll(): Promise<RCAEvidence[]> {
    return this.evidenceRepository.find();
  }

  findOne(id: string): Promise<RCAEvidence | null> {
    return this.evidenceRepository.findOneBy({ id });
  }

  create(data: Partial<RCAEvidence>): Promise<RCAEvidence> {
    const evidence = this.evidenceRepository.create(data);
    return this.evidenceRepository.save(evidence);
  }

  async update(id: string, data: Partial<RCAEvidence>): Promise<RCAEvidence | null> {
    await this.evidenceRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.evidenceRepository.delete(id);
  }
} 
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';
import { CreateRCAKnowledgeBaseDto } from './dto/create-rca-knowledge-base.dto';
import { UpdateRCAKnowledgeBaseDto } from './dto/update-rca-knowledge-base.dto';

@Injectable()
export class RCAKnowledgeBaseService {
  constructor(
    @InjectRepository(RCAKnowledgeBase)
    private readonly rcaKnowledgeBaseRepository: Repository<RCAKnowledgeBase>,
  ) {}

  async create(createDto: CreateRCAKnowledgeBaseDto): Promise<RCAKnowledgeBase> {
    const articleData: any = {
      rcaId: createDto.rcaId,
      title: createDto.title,
      description: createDto.description,
      problemStatement: createDto.problemStatement,
      eventType: createDto.eventType,
      unitId: createDto.unitId,
      unitName: createDto.unitName,
      assetId: createDto.assetId,
      assetName: createDto.assetName,
      equipmentCategory: createDto.equipmentCategory,
      category: createDto.category,
      rootCause: createDto.rootCause,
      rootCauseCategory: createDto.rootCauseCategory,
      content: createDto.content,
      author: createDto.author,
      closedDate: createDto.closedDate,
      tenantId: createDto.tenantId,
      organizationId: createDto.organizationId,
      recurrenceCount: createDto.recurrenceCount ?? 0,
      effectiveness: createDto.effectiveness ?? 0,
      costSaved: createDto.costSaved ?? null,
      downtimeReduced: createDto.downtimeReduced ?? null,
      timesReferenced: createDto.timesReferenced ?? 0,
      helpfulVotes: createDto.helpfulVotes ?? 0,
      isPublished: createDto.isPublished ?? false,
    };
    
    if (createDto.symptoms !== undefined) {
      articleData.symptoms = createDto.symptoms;
    }
    if (createDto.impactCodes !== undefined) {
      articleData.impactCodes = createDto.impactCodes;
    }
    if (createDto.oeeCodes !== undefined) {
      articleData.oeeCodes = createDto.oeeCodes;
    }
    if (createDto.contributingFactors !== undefined) {
      articleData.contributingFactors = createDto.contributingFactors;
    }
    if (createDto.recommendations !== undefined) {
      articleData.recommendations = createDto.recommendations;
    }
    if (createDto.keywords !== undefined) {
      articleData.keywords = createDto.keywords;
    }
    if (createDto.tags !== undefined) {
      articleData.tags = createDto.tags;
    }
    if (createDto.relatedRcas !== undefined) {
      articleData.relatedRcas = createDto.relatedRcas;
    }
    
    const article = this.rcaKnowledgeBaseRepository.create(articleData);
    return this.rcaKnowledgeBaseRepository.save(article) as unknown as RCAKnowledgeBase;
  }

  async findAll(filters?: {
    tenantId?: string;
    organizationId?: string;
    category?: string;
  }): Promise<RCAKnowledgeBase[]> {
    const where: Record<string, unknown> = {};

    if (filters?.tenantId) {
      where.tenantId = filters.tenantId;
    }

    if (filters?.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    return this.rcaKnowledgeBaseRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<RCAKnowledgeBase> {
    const article = await this.rcaKnowledgeBaseRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`RCA Knowledge Base article with ID ${id} not found`);
    }
    return article;
  }

  async update(id: string, updateDto: UpdateRCAKnowledgeBaseDto): Promise<RCAKnowledgeBase> {
    const article = await this.findOne(id);
    Object.assign(article, {
      ...updateDto,
      symptoms: updateDto.symptoms ?? article.symptoms ?? [],
      impactCodes: updateDto.impactCodes ?? article.impactCodes ?? [],
      oeeCodes: updateDto.oeeCodes ?? article.oeeCodes ?? [],
      contributingFactors: updateDto.contributingFactors ?? article.contributingFactors ?? [],
      recommendations: updateDto.recommendations ?? article.recommendations ?? [],
      keywords: updateDto.keywords ?? article.keywords ?? [],
      tags: updateDto.tags ?? article.tags ?? [],
      relatedRcas: updateDto.relatedRcas ?? article.relatedRcas ?? [],
      recurrenceCount: updateDto.recurrenceCount ?? article.recurrenceCount ?? 0,
      effectiveness: updateDto.effectiveness ?? article.effectiveness ?? 0,
      costSaved:
        updateDto.costSaved !== undefined ? updateDto.costSaved : article.costSaved ?? null,
      downtimeReduced:
        updateDto.downtimeReduced !== undefined
          ? updateDto.downtimeReduced
          : article.downtimeReduced ?? null,
      timesReferenced: updateDto.timesReferenced ?? article.timesReferenced ?? 0,
      helpfulVotes: updateDto.helpfulVotes ?? article.helpfulVotes ?? 0,
      isPublished: updateDto.isPublished ?? article.isPublished ?? false,
    });

    return this.rcaKnowledgeBaseRepository.save(article);
  }

  async remove(id: string): Promise<void> {
    const result = await this.rcaKnowledgeBaseRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`RCA Knowledge Base article with ID ${id} not found`);
    }
  }
}


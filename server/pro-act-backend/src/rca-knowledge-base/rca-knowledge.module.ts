import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RcaKnowledgeSharedService } from './knowledge-shared.service';
import { RcaKnowledgeSimilarService } from './knowledge-similar.service';
import { RcaKnowledgeV2CommandsService } from './knowledge-v2-commands.service';
import { RcaKnowledgeV2Service } from './knowledge-v2.service';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';
import { RcaKnowledgeVote } from './rca-knowledge-vote.entity';

/**
 * Services of the v2 RCA knowledge base (owner decision 2026-10-12); the routes are
 * `RcaKnowledgeV2Controller` in `V2Module` (the v1 `/rca-knowledge-base` routes are retired).
 */
@Module({
  imports: [TypeOrmModule.forFeature([RCAKnowledgeBase, RcaKnowledgeVote])],
  providers: [
    RcaKnowledgeV2Service,
    RcaKnowledgeV2CommandsService,
    RcaKnowledgeSimilarService,
    RcaKnowledgeSharedService,
  ],
  exports: [
    RcaKnowledgeV2Service,
    RcaKnowledgeV2CommandsService,
    RcaKnowledgeSimilarService,
    RcaKnowledgeSharedService,
  ],
})
export class RcaKnowledgeModule {}

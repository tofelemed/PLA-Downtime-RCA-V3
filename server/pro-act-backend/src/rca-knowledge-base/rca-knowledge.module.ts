import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RcaKnowledgeSimilarService } from './knowledge-similar.service';
import { RcaKnowledgeV2CommandsService } from './knowledge-v2-commands.service';
import { RcaKnowledgeV2Service } from './knowledge-v2.service';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';
import { RcaKnowledgeVote } from './rca-knowledge-vote.entity';

/**
 * Services of the v2 RCA knowledge base (owner decision 2026-10-12); the routes are
 * `RcaKnowledgeV2Controller` in `V2Module`. No controllers here, so the v1 routes stay in
 * `RCAKnowledgeBaseModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RCAKnowledgeBase, RcaKnowledgeVote])],
  providers: [
    RcaKnowledgeV2Service,
    RcaKnowledgeV2CommandsService,
    RcaKnowledgeSimilarService,
  ],
  exports: [
    RcaKnowledgeV2Service,
    RcaKnowledgeV2CommandsService,
    RcaKnowledgeSimilarService,
  ],
})
export class RcaKnowledgeModule {}

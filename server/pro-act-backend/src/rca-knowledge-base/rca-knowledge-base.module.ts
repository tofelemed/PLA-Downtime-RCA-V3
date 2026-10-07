import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';
import { RCAKnowledgeBaseController } from './rca-knowledge-base.controller';
import { RCAKnowledgeBaseService } from './rca-knowledge-base.service';

@Module({
  imports: [TypeOrmModule.forFeature([RCAKnowledgeBase])],
  controllers: [RCAKnowledgeBaseController],
  providers: [RCAKnowledgeBaseService],
  exports: [RCAKnowledgeBaseService],
})
export class RCAKnowledgeBaseModule {}


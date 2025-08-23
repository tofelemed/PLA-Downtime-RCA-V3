import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogicTreeNodeController } from './logic-tree-node.controller';
import { LogicTreeNodeService } from './logic-tree-node.service';
import { LogicTreeNode } from './logic-tree-node.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LogicTreeNode])],
  controllers: [LogicTreeNodeController],
  providers: [LogicTreeNodeService],
  exports: [LogicTreeNodeService],
})
export class LogicTreeNodeModule {} 
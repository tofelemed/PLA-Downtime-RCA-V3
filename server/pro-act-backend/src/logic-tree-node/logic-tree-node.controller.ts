import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe, UploadedFile, UseInterceptors, Req } from '@nestjs/common';
import { LogicTreeNodeService } from './logic-tree-node.service';
import { LogicTreeNode } from './logic-tree-node.entity';
import { ApiTags, ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLogicTreeNodeDto } from './dto/create-logic-tree-node.dto';
import { UpdateLogicTreeNodeDto } from './dto/update-logic-tree-node.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  attachmentUploadOptions,
  uploadedFileView,
} from '../common/http/upload-options';
import type { Request } from 'express';

@ApiTags('Logic Tree Nodes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logic-tree-nodes')
export class LogicTreeNodeController {
  constructor(private readonly nodeService: LogicTreeNodeService) {}

  @Get()
  findAll(
    @Query('rcaId') rcaId?: string,
    @Query('parentId') parentId?: string,
    @Query('type') type?: string,
    @Query('root') root?: string,
    @Query('verified') verified?: string,
  ): Promise<LogicTreeNode[]> {
    if (root === 'true' && rcaId) {
      return this.nodeService.findRootNodes(rcaId);
    }
    if (verified === 'true' && rcaId) {
      return this.nodeService.findVerified(rcaId);
    }
    if (type && rcaId) {
      return this.nodeService.findByType(rcaId, type);
    }
    if (parentId) {
      return this.nodeService.findByParent(parentId);
    }
    if (rcaId) {
      return this.nodeService.findByRCA(rcaId);
    }
    return this.nodeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LogicTreeNode | null> {
    return this.nodeService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateLogicTreeNodeDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateLogicTreeNodeDto): Promise<LogicTreeNode> {
    return this.nodeService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateLogicTreeNodeDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateLogicTreeNodeDto): Promise<LogicTreeNode | null> {
    return this.nodeService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.nodeService.remove(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload logic tree node evidence file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions()))
  uploadEvidenceFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    return uploadedFileView(file, request);
  }
} 
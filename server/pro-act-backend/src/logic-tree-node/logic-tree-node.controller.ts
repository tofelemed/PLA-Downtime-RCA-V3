import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { LogicTreeNodeService } from './logic-tree-node.service';
import { LogicTreeNode } from './logic-tree-node.entity';
import { ApiTags, ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateLogicTreeNodeDto } from './dto/create-logic-tree-node.dto';
import { UpdateLogicTreeNodeDto } from './dto/update-logic-tree-node.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

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
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  uploadEvidenceFile(@UploadedFile() file: Express.Multer.File) {
    return {
      originalName: file.originalname,
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
} 
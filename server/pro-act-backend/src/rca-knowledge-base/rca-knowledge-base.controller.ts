import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RCAKnowledgeBaseService } from './rca-knowledge-base.service';
import { CreateRCAKnowledgeBaseDto } from './dto/create-rca-knowledge-base.dto';
import { UpdateRCAKnowledgeBaseDto } from './dto/update-rca-knowledge-base.dto';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('RCA Knowledge Base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-knowledge-base')
export class RCAKnowledgeBaseController {
  constructor(private readonly rcaKnowledgeBaseService: RCAKnowledgeBaseService) {}

  @Post()
  @ApiOperation({ summary: 'Create knowledge base article' })
  @ApiResponse({ status: 201, description: 'Article created successfully', type: RCAKnowledgeBase })
  create(@Body() createDto: CreateRCAKnowledgeBaseDto): Promise<RCAKnowledgeBase> {
    return this.rcaKnowledgeBaseService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all knowledge base articles' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiResponse({ status: 200, description: 'Return all articles', type: [RCAKnowledgeBase] })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('category') category?: string,
  ): Promise<RCAKnowledgeBase[]> {
    return this.rcaKnowledgeBaseService.findAll({ tenantId, organizationId, category });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get knowledge base article by ID' })
  @ApiResponse({ status: 200, description: 'Return article', type: RCAKnowledgeBase })
  findOne(@Param('id') id: string): Promise<RCAKnowledgeBase> {
    return this.rcaKnowledgeBaseService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update knowledge base article' })
  @ApiResponse({ status: 200, description: 'Article updated successfully', type: RCAKnowledgeBase })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRCAKnowledgeBaseDto,
  ): Promise<RCAKnowledgeBase> {
    return this.rcaKnowledgeBaseService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete knowledge base article' })
  @ApiResponse({ status: 204, description: 'Article deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.rcaKnowledgeBaseService.remove(id);
  }
}


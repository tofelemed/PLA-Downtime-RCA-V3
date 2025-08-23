import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { EvidenceCategoryService } from './evidence-category.service';
import { EvidenceCategory } from './evidence-category.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEvidenceCategoryDto } from './dto/create-evidence-category.dto';
import { UpdateEvidenceCategoryDto } from './dto/update-evidence-category.dto';

@ApiTags('Evidence Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evidence-categories')
export class EvidenceCategoryController {
  constructor(private readonly categoryService: EvidenceCategoryService) {}

  @Get()
  findAll(@Query('tenantId') tenantId?: string): Promise<EvidenceCategory[]> {
    if (tenantId) {
      return this.categoryService.findByTenant(tenantId);
    }
    return this.categoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EvidenceCategory | null> {
    return this.categoryService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateEvidenceCategoryDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateEvidenceCategoryDto): Promise<EvidenceCategory> {
    return this.categoryService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateEvidenceCategoryDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateEvidenceCategoryDto): Promise<EvidenceCategory | null> {
    return this.categoryService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.categoryService.remove(id);
  }
} 
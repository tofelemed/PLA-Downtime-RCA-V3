import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { EvidenceLocationService } from './evidence-location.service';
import { EvidenceLocation } from './evidence-location.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEvidenceLocationDto } from './dto/create-evidence-location.dto';
import { UpdateEvidenceLocationDto } from './dto/update-evidence-location.dto';

@ApiTags('Evidence Locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evidence-locations')
export class EvidenceLocationController {
  constructor(private readonly locationService: EvidenceLocationService) {}

  @Get()
  findAll(@Query('tenantId') tenantId?: string): Promise<EvidenceLocation[]> {
    if (tenantId) {
      return this.locationService.findByTenant(tenantId);
    }
    return this.locationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EvidenceLocation | null> {
    return this.locationService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateEvidenceLocationDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateEvidenceLocationDto): Promise<EvidenceLocation> {
    return this.locationService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateEvidenceLocationDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateEvidenceLocationDto): Promise<EvidenceLocation | null> {
    return this.locationService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.locationService.remove(id);
  }
}

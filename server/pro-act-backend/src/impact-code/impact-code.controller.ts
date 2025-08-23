import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ImpactCodeService } from './impact-code.service';
import { ImpactCode } from './impact-code.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateImpactCodeDto } from './dto/create-impact-code.dto';
import { UpdateImpactCodeDto } from './dto/update-impact-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Impact Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('impact-codes')
export class ImpactCodeController {
  constructor(private readonly impactCodeService: ImpactCodeService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all impact codes', type: [ImpactCode] })
  findAll(): Promise<ImpactCode[]> {
    return this.impactCodeService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get impact code by ID', type: ImpactCode })
  findOne(@Param('id') id: string): Promise<ImpactCode | null> {
    return this.impactCodeService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateImpactCodeDto })
  @ApiResponse({ status: 201, description: 'Create impact code', type: ImpactCode })
  create(@Body() data: CreateImpactCodeDto): Promise<ImpactCode> {
    return this.impactCodeService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateImpactCodeDto })
  @ApiResponse({ status: 200, description: 'Update impact code', type: ImpactCode })
  update(@Param('id') id: string, @Body() data: UpdateImpactCodeDto): Promise<ImpactCode | null> {
    return this.impactCodeService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete impact code' })
  remove(@Param('id') id: string): Promise<void> {
    return this.impactCodeService.remove(id);
  }
} 
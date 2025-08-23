import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { UnitService } from './unit.service';
import { Unit } from './unit.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('units')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all units', type: [Unit] })
  findAll(): Promise<Unit[]> {
    return this.unitService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get unit by ID', type: Unit })
  findOne(@Param('id') id: string): Promise<Unit | null> {
    return this.unitService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateUnitDto })
  @ApiResponse({ status: 201, description: 'Create unit', type: Unit })
  create(@Body() data: CreateUnitDto): Promise<Unit> {
    return this.unitService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateUnitDto })
  @ApiResponse({ status: 200, description: 'Update unit', type: Unit })
  update(@Param('id') id: string, @Body() data: UpdateUnitDto): Promise<Unit | null> {
    return this.unitService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete unit' })
  remove(@Param('id') id: string): Promise<void> {
    return this.unitService.remove(id);
  }
} 
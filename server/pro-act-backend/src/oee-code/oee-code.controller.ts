import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { OEECodeService } from './oee-code.service';
import { OEECode } from './oee-code.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateOeeCodeDto } from './dto/create-oee-code.dto';
import { UpdateOeeCodeDto } from './dto/update-oee-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('OEE Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('oee-codes')
export class OEECodeController {
  constructor(private readonly oeeCodeService: OEECodeService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all OEE codes', type: [OEECode] })
  findAll(): Promise<OEECode[]> {
    return this.oeeCodeService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get OEE code by ID', type: OEECode })
  findOne(@Param('id') id: string): Promise<OEECode | null> {
    return this.oeeCodeService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateOeeCodeDto })
  @ApiResponse({ status: 201, description: 'Create OEE code', type: OEECode })
  create(@Body() data: CreateOeeCodeDto): Promise<OEECode> {
    return this.oeeCodeService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateOeeCodeDto })
  @ApiResponse({ status: 200, description: 'Update OEE code', type: OEECode })
  update(@Param('id') id: string, @Body() data: UpdateOeeCodeDto): Promise<OEECode | null> {
    return this.oeeCodeService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete OEE code' })
  remove(@Param('id') id: string): Promise<void> {
    return this.oeeCodeService.remove(id);
  }
} 
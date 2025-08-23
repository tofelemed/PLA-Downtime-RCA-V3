import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { VerificationStatusCodeService } from './verification-status-code.service';
import { VerificationStatusCode } from './verification-status-code.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateVerificationStatusCodeDto } from './dto/create-verification-status-code.dto';
import { UpdateVerificationStatusCodeDto } from './dto/update-verification-status-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Verification Status Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('verification-status-codes')
export class VerificationStatusCodeController {
  constructor(private readonly verificationStatusCodeService: VerificationStatusCodeService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all verification status codes', type: [VerificationStatusCode] })
  findAll(): Promise<VerificationStatusCode[]> {
    return this.verificationStatusCodeService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get verification status code by ID', type: VerificationStatusCode })
  findOne(@Param('id') id: string): Promise<VerificationStatusCode | null> {
    return this.verificationStatusCodeService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateVerificationStatusCodeDto })
  @ApiResponse({ status: 201, description: 'Create verification status code', type: VerificationStatusCode })
  create(@Body() data: CreateVerificationStatusCodeDto): Promise<VerificationStatusCode> {
    return this.verificationStatusCodeService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateVerificationStatusCodeDto })
  @ApiResponse({ status: 200, description: 'Update verification status code', type: VerificationStatusCode })
  update(@Param('id') id: string, @Body() data: UpdateVerificationStatusCodeDto): Promise<VerificationStatusCode | null> {
    return this.verificationStatusCodeService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete verification status code' })
  remove(@Param('id') id: string): Promise<void> {
    return this.verificationStatusCodeService.remove(id);
  }
} 
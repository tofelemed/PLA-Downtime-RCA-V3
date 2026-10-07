import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ReasonCodeService } from './reason-code.service';
import { ReasonCode } from './reason-code.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReasonCodeDto } from './dto/create-reason-code.dto';
import { UpdateReasonCodeDto } from './dto/update-reason-code.dto';

@ApiTags('Reason Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reason-codes')
export class ReasonCodeController {
  constructor(private readonly reasonCodeService: ReasonCodeService) {}

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    // Note: parentId doesn't exist in database schema, so this filter is not supported
    // @Query('parentId') parentId?: string,
    // Note: root filter is not supported since parentId doesn't exist
    // @Query('root') root?: string,
  ): Promise<ReasonCode[]> {
    // Note: root and parentId filters are not supported since parentId doesn't exist in database
    // if (root === 'true' && tenantId) {
    //   return this.reasonCodeService.findRootCodes(tenantId);
    // }
    // if (parentId) {
    //   return this.reasonCodeService.findByParent(parentId);
    // }
    if (tenantId) {
      return this.reasonCodeService.findByTenant(tenantId);
    }
    return this.reasonCodeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ReasonCode | null> {
    return this.reasonCodeService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateReasonCodeDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateReasonCodeDto): Promise<ReasonCode> {
    return this.reasonCodeService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateReasonCodeDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Param('id') id: string, @Body() data: UpdateReasonCodeDto): Promise<ReasonCode | null> {
    return this.reasonCodeService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.reasonCodeService.remove(id);
  }
} 
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RCACauseCodeService } from './rca-cause-code.service';
import { RCACauseCode } from './rca-cause-code.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateRcaCauseCodeDto } from './dto/create-rca-cause-code.dto';
import { UpdateRcaCauseCodeDto } from './dto/update-rca-cause-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MASTER_DATA_WRITERS } from '../v2/master-data/common/master-data-writer';

@ApiTags('RCA Cause Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-cause-codes')
export class RCACauseCodeController {
  constructor(private readonly rcaCauseCodeService: RCACauseCodeService) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'List RCA cause codes',
    type: [RCACauseCode],
  })
  findAll(
    @Query('tenantId') tenantId?: string,
    // Note: parentId doesn't exist in database schema, so this filter is not supported
    // @Query('parentId') parentId?: string,
    // Note: root filter is not supported since parentId doesn't exist
    // @Query('root') root?: string,
  ): Promise<RCACauseCode[]> {
    return this.rcaCauseCodeService.findAll({
      tenantId,
      // parentId,
      // root: root === 'true',
    });
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'Get RCA cause code by ID',
    type: RCACauseCode,
  })
  findOne(@Param('id') id: string): Promise<RCACauseCode | null> {
    return this.rcaCauseCodeService.findOne(id);
  }

  @Roles(...MASTER_DATA_WRITERS)
  @Post()
  @ApiBody({ type: CreateRcaCauseCodeDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiResponse({
    status: 201,
    description: 'Create RCA cause code',
    type: RCACauseCode,
  })
  create(@Body() data: CreateRcaCauseCodeDto): Promise<RCACauseCode> {
    return this.rcaCauseCodeService.create(data);
  }

  @Roles(...MASTER_DATA_WRITERS)
  @Put(':id')
  @ApiBody({ type: UpdateRcaCauseCodeDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiResponse({
    status: 200,
    description: 'Update RCA cause code',
    type: RCACauseCode,
  })
  update(
    @Param('id') id: string,
    @Body() data: UpdateRcaCauseCodeDto,
  ): Promise<RCACauseCode | null> {
    return this.rcaCauseCodeService.update(id, data);
  }

  @Roles(...MASTER_DATA_WRITERS)
  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete RCA cause code' })
  remove(@Param('id') id: string): Promise<void> {
    return this.rcaCauseCodeService.remove(id);
  }
}

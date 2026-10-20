import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { AssetService } from './asset.service';
import { Asset } from './asset.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { TenantBound } from '../auth/decorators/tenant-bound.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

/** Master data (§13.2): any member reads; writes need master_data_admin or manager_approver (admins via satisfiesRole). */
@ApiTags('Assets')
@ApiBearerAuth()
@TenantBound()
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'List all assets', type: [Asset] })
  findAll(): Promise<Asset[]> {
    return this.assetService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get asset by ID', type: Asset })
  findOne(@Param('id') id: string): Promise<Asset | null> {
    return this.assetService.findOne(id);
  }

  @Post()
  @Roles('master_data_admin', 'manager_approver')
  @ApiBody({ type: CreateAssetDto })
  @ApiResponse({ status: 201, description: 'Create asset', type: Asset })
  create(@Body() data: CreateAssetDto): Promise<Asset> {
    return this.assetService.create(data);
  }

  @Put(':id')
  @Roles('master_data_admin', 'manager_approver')
  @ApiBody({ type: UpdateAssetDto })
  @ApiResponse({ status: 200, description: 'Update asset', type: Asset })
  update(
    @Param('id') id: string,
    @Body() data: UpdateAssetDto,
  ): Promise<Asset | null> {
    return this.assetService.update(id, data);
  }

  @Delete(':id')
  @Roles('master_data_admin', 'manager_approver')
  @ApiResponse({ status: 200, description: 'Delete asset' })
  remove(@Param('id') id: string): Promise<void> {
    return this.assetService.remove(id);
  }
}

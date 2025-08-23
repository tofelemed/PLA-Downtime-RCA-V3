import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AssetService } from './asset.service';
import { Asset } from './asset.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @ApiBody({ type: CreateAssetDto })
  @ApiResponse({ status: 201, description: 'Create asset', type: Asset })
  create(@Body() data: CreateAssetDto): Promise<Asset> {
    return this.assetService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateAssetDto })
  @ApiResponse({ status: 200, description: 'Update asset', type: Asset })
  update(@Param('id') id: string, @Body() data: UpdateAssetDto): Promise<Asset | null> {
    return this.assetService.update(id, data);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Delete asset' })
  remove(@Param('id') id: string): Promise<void> {
    return this.assetService.remove(id);
  }
} 
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HistorianHistoryService } from './historian-history.service';
import { CreateQueryHistoryDto } from './dto/create-query-history.dto';
import { QueryHistory } from './historian-history.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Historian History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('historian/history')
export class HistorianHistoryController {
  constructor(private readonly historianHistoryService: HistorianHistoryService) {}

  // 1. Save query history (replaces all for tenant)
  @Put(':tenantId')
  @ApiOperation({ summary: 'Save query history for tenant (replaces all)' })
  @ApiResponse({ status: 200, description: 'History saved successfully' })
  @HttpCode(200)
  async saveQueryHistory(
    @Param('tenantId') tenantId: string,
    @Body() history: CreateQueryHistoryDto[]
  ): Promise<void> {
    return this.historianHistoryService.saveQueryHistory(tenantId, history);
  }

  // 2. Load query history for tenant
  @Get(':tenantId')
  @ApiOperation({ summary: 'Load query history for tenant' })
  @ApiResponse({ status: 200, description: 'Return query history', type: [QueryHistory] })
  async loadQueryHistory(@Param('tenantId') tenantId: string): Promise<QueryHistory[]> {
    return this.historianHistoryService.loadQueryHistory(tenantId);
  }

  // 3. Add single query history entry
  @Post(':tenantId')
  @ApiOperation({ summary: 'Add single query history entry' })
  @ApiResponse({ status: 201, description: 'Entry added successfully', type: QueryHistory })
  async addQueryHistoryEntry(
    @Param('tenantId') tenantId: string,
    @Body() entry: CreateQueryHistoryDto
  ): Promise<QueryHistory> {
    return this.historianHistoryService.addQueryHistoryEntry(tenantId, entry);
  }

  // 4. Remove query history entry by ID
  @Delete('entry/:id')
  @ApiOperation({ summary: 'Remove query history entry by ID' })
  @ApiResponse({ status: 204, description: 'Entry deleted successfully' })
  @HttpCode(204)
  async removeQueryHistoryEntry(@Param('id') id: string): Promise<void> {
    return this.historianHistoryService.removeQueryHistoryEntry(id);
  }

  // 5. Clear all query history for tenant
  @Delete(':tenantId')
  @ApiOperation({ summary: 'Clear all query history for tenant' })
  @ApiResponse({ status: 204, description: 'History cleared successfully' })
  @HttpCode(204)
  async clearQueryHistory(@Param('tenantId') tenantId: string): Promise<void> {
    return this.historianHistoryService.clearQueryHistory(tenantId);
  }

  // 6. Export query history (formatted)
  @Get(':tenantId/export')
  @ApiOperation({ summary: 'Export query history (formatted)' })
  @ApiResponse({ status: 200, description: 'Return formatted history' })
  async exportQueryHistory(@Param('tenantId') tenantId: string): Promise<any[]> {
    return this.historianHistoryService.exportQueryHistory(tenantId);
  }

  // 7. Import query history
  @Post(':tenantId/import')
  @ApiOperation({ summary: 'Import query history' })
  @ApiResponse({ status: 201, description: 'History imported successfully' })
  async importQueryHistory(
    @Param('tenantId') tenantId: string,
    @Body() importedData: any[]
  ): Promise<void> {
    return this.historianHistoryService.importQueryHistory(tenantId, importedData);
  }

  // 8. Force database recreation (development only)
  @Post('recreate')
  @ApiOperation({ summary: 'Force database recreation (development only)' })
  @ApiResponse({ status: 200, description: 'Database recreated successfully' })
  async forceDatabaseRecreation(): Promise<void> {
    return this.historianHistoryService.forceDatabaseRecreation();
  }
}


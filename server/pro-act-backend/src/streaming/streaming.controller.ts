import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamingService } from './streaming.service';
import { UpsertStreamDataSourceDto } from './dto/upsert-stream-data-source.dto';
import { UpsertStreamDataSinkDto } from './dto/upsert-stream-data-sink.dto';
import { UpsertStreamProcessorDto } from './dto/upsert-stream-processor.dto';
import { UpsertStreamMetricDto } from './dto/upsert-stream-metric.dto';
import { UpsertStreamAlertDto } from './dto/upsert-stream-alert.dto';
import { UpsertStreamConnectionConfigDto } from './dto/upsert-stream-connection-config.dto';
import { StreamDataSourceQueryDto } from './dto/stream-data-source-query.dto';
import { StreamDataSinkQueryDto } from './dto/stream-data-sink-query.dto';
import { StreamProcessorQueryDto } from './dto/stream-processor-query.dto';
import { StreamMetricQueryDto } from './dto/stream-metric-query.dto';
import { StreamAlertQueryDto } from './dto/stream-alert-query.dto';
import { StreamConnectionConfigQueryDto } from './dto/stream-connection-config-query.dto';
import { ImportStreamingPayloadDto } from './dto/import-streaming-payload.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Streaming')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('streaming')
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  // Data sources
  @Post('data-sources')
  @ApiOperation({ summary: 'Create or update a stream data source' })
  upsertDataSource(@Body() dto: UpsertStreamDataSourceDto) {
    return this.streamingService.upsertDataSource(dto);
  }

  @Get('data-sources')
  @ApiOperation({ summary: 'List stream data sources' })
  findAllDataSources(@Query() query: StreamDataSourceQueryDto) {
    return this.streamingService.findAllDataSources(query);
  }

  @Get('data-sources/:id')
  @ApiOperation({ summary: 'Get stream data source by id' })
  findDataSourceById(@Param('id') id: string) {
    return this.streamingService.findDataSourceById(id);
  }

  @Delete('data-sources/:id')
  @ApiOperation({ summary: 'Delete a stream data source' })
  deleteDataSource(@Param('id') id: string) {
    return this.streamingService.deleteDataSource(id);
  }

  // Data sinks
  @Post('data-sinks')
  @ApiOperation({ summary: 'Create or update a stream data sink' })
  upsertDataSink(@Body() dto: UpsertStreamDataSinkDto) {
    return this.streamingService.upsertDataSink(dto);
  }

  @Get('data-sinks')
  @ApiOperation({ summary: 'List stream data sinks' })
  findAllDataSinks(@Query() query: StreamDataSinkQueryDto) {
    return this.streamingService.findAllDataSinks(query);
  }

  @Get('data-sinks/:id')
  @ApiOperation({ summary: 'Get stream data sink by id' })
  findDataSinkById(@Param('id') id: string) {
    return this.streamingService.findDataSinkById(id);
  }

  @Delete('data-sinks/:id')
  @ApiOperation({ summary: 'Delete a stream data sink' })
  deleteDataSink(@Param('id') id: string) {
    return this.streamingService.deleteDataSink(id);
  }

  // Stream processors
  @Post('processors')
  @ApiOperation({ summary: 'Create or update a stream processor' })
  upsertStreamProcessor(@Body() dto: UpsertStreamProcessorDto) {
    return this.streamingService.upsertStreamProcessor(dto);
  }

  @Get('processors')
  @ApiOperation({ summary: 'List stream processors' })
  findAllStreamProcessors(@Query() query: StreamProcessorQueryDto) {
    return this.streamingService.findAllStreamProcessors(query);
  }

  @Get('processors/:id')
  @ApiOperation({ summary: 'Get stream processor by id' })
  findStreamProcessorById(@Param('id') id: string) {
    return this.streamingService.findStreamProcessorById(id);
  }

  @Delete('processors/:id')
  @ApiOperation({ summary: 'Delete a stream processor' })
  deleteStreamProcessor(@Param('id') id: string) {
    return this.streamingService.deleteStreamProcessor(id);
  }

  // Metrics
  @Post('metrics')
  @ApiOperation({ summary: 'Create a stream metric entry' })
  saveStreamMetric(@Body() dto: UpsertStreamMetricDto) {
    return this.streamingService.saveStreamMetric(dto);
  }

  @Get('metrics/latest')
  @ApiOperation({ summary: 'Get latest metrics snapshot' })
  getLatestMetric(@Query() query: StreamMetricQueryDto) {
    return this.streamingService.getLatestMetric(query);
  }

  @Get('metrics/history')
  @ApiOperation({ summary: 'Get metrics history' })
  getMetricHistory(@Query() query: StreamMetricQueryDto) {
    return this.streamingService.getMetricHistory(query);
  }

  @Delete('metrics')
  @ApiOperation({ summary: 'Purge all stream metrics' })
  purgeMetrics() {
    return this.streamingService.purgeMetrics();
  }

  // Alerts
  @Post('alerts')
  @ApiOperation({ summary: 'Create or update a stream alert' })
  upsertStreamAlert(@Body() dto: UpsertStreamAlertDto) {
    return this.streamingService.upsertStreamAlert(dto);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'List stream alerts' })
  findAllAlerts(@Query() query: StreamAlertQueryDto) {
    return this.streamingService.findAllAlerts(query);
  }

  @Get('alerts/active')
  @ApiOperation({ summary: 'List active stream alerts' })
  findActiveAlerts(@Query() query: StreamAlertQueryDto) {
    return this.streamingService.findActiveAlerts(query);
  }

  @Get('alerts/:id')
  @ApiOperation({ summary: 'Get stream alert by id' })
  findAlertById(@Param('id') id: string) {
    return this.streamingService.findAlertById(id);
  }

  @Patch('alerts/:id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a stream alert' })
  acknowledgeAlert(@Param('id') id: string) {
    return this.streamingService.acknowledgeAlert(id);
  }

  @Delete('alerts/:id')
  @ApiOperation({ summary: 'Delete a stream alert' })
  deleteAlert(@Param('id') id: string) {
    return this.streamingService.deleteAlert(id);
  }

  // Connection configs
  @Post('connection-configs')
  @ApiOperation({ summary: 'Create or update a stream connection config' })
  upsertConnectionConfig(@Body() dto: UpsertStreamConnectionConfigDto) {
    return this.streamingService.upsertConnectionConfig(dto);
  }

  @Get('connection-configs')
  @ApiOperation({ summary: 'List stream connection configs' })
  findAllConnectionConfigs(@Query() query: StreamConnectionConfigQueryDto) {
    return this.streamingService.findAllConnectionConfigs(query);
  }

  @Get('connection-configs/:id')
  @ApiOperation({ summary: 'Get stream connection config by id' })
  findConnectionConfigById(@Param('id') id: string) {
    return this.streamingService.findConnectionConfigById(id);
  }

  @Delete('connection-configs/:id')
  @ApiOperation({ summary: 'Delete a stream connection config' })
  deleteConnectionConfig(@Param('id') id: string) {
    return this.streamingService.deleteConnectionConfig(id);
  }

  // Bulk operations
  @Get('export')
  @ApiOperation({ summary: 'Export all streaming data for the current scope' })
  exportAllData(@Query() query: StreamDataSourceQueryDto) {
    return this.streamingService.exportAllData(query);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import streaming data payload' })
  importAllData(@Body() payload: ImportStreamingPayloadDto) {
    return this.streamingService.importAllData(payload);
  }

  @Delete('purge')
  @ApiOperation({ summary: 'Clear all streaming data (optionally scoped)' })
  clearAllData(@Query() scope: StreamDataSourceQueryDto) {
    return this.streamingService.clearAllData(scope);
  }
}



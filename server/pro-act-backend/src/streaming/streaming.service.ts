import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamDataSource } from './entities/stream-data-source.entity';
import { StreamDataSink } from './entities/stream-data-sink.entity';
import { StreamProcessorEntity } from './entities/stream-processor.entity';
import { StreamMetricEntity } from './entities/stream-metric.entity';
import { StreamAlertEntity } from './entities/stream-alert.entity';
import { StreamConnectionConfigEntity } from './entities/stream-connection-config.entity';
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
import { RealtimeGateway } from '../realtime.gateway';

@Injectable()
export class StreamingService {
  constructor(
    @InjectRepository(StreamDataSource)
    private readonly dataSourceRepository: Repository<StreamDataSource>,
    @InjectRepository(StreamDataSink)
    private readonly dataSinkRepository: Repository<StreamDataSink>,
    @InjectRepository(StreamProcessorEntity)
    private readonly processorRepository: Repository<StreamProcessorEntity>,
    @InjectRepository(StreamMetricEntity)
    private readonly metricRepository: Repository<StreamMetricEntity>,
    @InjectRepository(StreamAlertEntity)
    private readonly alertRepository: Repository<StreamAlertEntity>,
    @InjectRepository(StreamConnectionConfigEntity)
    private readonly connectionConfigRepository: Repository<StreamConnectionConfigEntity>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // #region Data Sources
  async upsertDataSource(dto: UpsertStreamDataSourceDto): Promise<StreamDataSource> {
    const existing = await this.dataSourceRepository.findOne({ where: { id: dto.id } });
    const entity = this.dataSourceRepository.create({
      ...dto,
      lastUpdate: dto.lastUpdate ? new Date(dto.lastUpdate) : dto.lastUpdate === null ? null : existing?.lastUpdate ?? null,
    });
    const saved = await this.dataSourceRepository.save(entity);
    if (existing) {
      this.realtimeGateway.broadcastEntityUpdated('streamDataSource', saved);
    } else {
      this.realtimeGateway.broadcastEntityCreated('streamDataSource', saved);
    }
    return saved;
  }

  async findAllDataSources(query: StreamDataSourceQueryDto): Promise<StreamDataSource[]> {
    const where: Record<string, any> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.connectorType) where.connectorType = query.connectorType;
    if (query.status) where.status = query.status;
    if (query.enabled !== undefined) where.enabled = query.enabled;
    return this.dataSourceRepository.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async findDataSourceById(id: string): Promise<StreamDataSource> {
    const entity = await this.dataSourceRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Data source ${id} not found`);
    }
    return entity;
  }

  async deleteDataSource(id: string): Promise<void> {
    const existing = await this.dataSourceRepository.findOne({ where: { id } });
    if (!existing) {
      return;
    }
    await this.dataSourceRepository.delete(id);
    this.realtimeGateway.broadcastEntityDeleted('streamDataSource', id);
  }
  // #endregion

  // #region Data Sinks
  async upsertDataSink(dto: UpsertStreamDataSinkDto): Promise<StreamDataSink> {
    const existing = await this.dataSinkRepository.findOne({ where: { id: dto.id } });
    const entity = this.dataSinkRepository.create({
      ...dto,
      lastWrite: dto.lastWrite ? new Date(dto.lastWrite) : dto.lastWrite === null ? null : existing?.lastWrite ?? null,
    });
    const saved = await this.dataSinkRepository.save(entity);
    if (existing) {
      this.realtimeGateway.broadcastEntityUpdated('streamDataSink', saved);
    } else {
      this.realtimeGateway.broadcastEntityCreated('streamDataSink', saved);
    }
    return saved;
  }

  async findAllDataSinks(query: StreamDataSinkQueryDto): Promise<StreamDataSink[]> {
    const where: Record<string, any> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.type) where.type = query.type;
    if (query.enabled !== undefined) where.enabled = query.enabled;
    return this.dataSinkRepository.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async findDataSinkById(id: string): Promise<StreamDataSink> {
    const entity = await this.dataSinkRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Data sink ${id} not found`);
    }
    return entity;
  }

  async deleteDataSink(id: string): Promise<void> {
    const existing = await this.dataSinkRepository.findOne({ where: { id } });
    if (!existing) {
      return;
    }
    await this.dataSinkRepository.delete(id);
    this.realtimeGateway.broadcastEntityDeleted('streamDataSink', id);
  }
  // #endregion

  // #region Stream Processors
  async upsertStreamProcessor(dto: UpsertStreamProcessorDto): Promise<StreamProcessorEntity> {
    const existing = await this.processorRepository.findOne({ where: { id: dto.id } });
    const entity = this.processorRepository.create(dto);
    const saved = await this.processorRepository.save(entity);
    if (existing) {
      this.realtimeGateway.broadcastEntityUpdated('streamProcessor', saved);
    } else {
      this.realtimeGateway.broadcastEntityCreated('streamProcessor', saved);
    }
    return saved;
  }

  async findAllStreamProcessors(query: StreamProcessorQueryDto): Promise<StreamProcessorEntity[]> {
    const where: Record<string, any> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.type) where.type = query.type;
    if (query.enabled !== undefined) where.enabled = query.enabled;
    return this.processorRepository.find({
      where,
      order: { order: 'ASC', updatedAt: 'DESC' },
    });
  }

  async findStreamProcessorById(id: string): Promise<StreamProcessorEntity> {
    const entity = await this.processorRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Stream processor ${id} not found`);
    }
    return entity;
  }

  async deleteStreamProcessor(id: string): Promise<void> {
    const existing = await this.processorRepository.findOne({ where: { id } });
    if (!existing) {
      return;
    }
    await this.processorRepository.delete(id);
    this.realtimeGateway.broadcastEntityDeleted('streamProcessor', id);
  }
  // #endregion

  // #region Metrics
  async saveStreamMetric(dto: UpsertStreamMetricDto): Promise<StreamMetricEntity> {
    const entity = this.metricRepository.create({
      ...dto,
      timestamp: new Date(dto.timestamp),
    });
    const saved = await this.metricRepository.save(entity);
    this.realtimeGateway.broadcastEntityCreated('streamMetric', saved);
    return saved;
  }

  async getLatestMetric(query: StreamMetricQueryDto): Promise<StreamMetricEntity | null> {
    const where: Record<string, any> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    return this.metricRepository.findOne({
      where,
      order: { timestamp: 'DESC' },
    });
  }

  async getMetricHistory(query: StreamMetricQueryDto): Promise<StreamMetricEntity[]> {
    const where: Record<string, any> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    return this.metricRepository.find({
      where,
      order: { timestamp: 'DESC' },
      take: query.limit ?? 100,
    });
  }

  async purgeMetrics(): Promise<void> {
    await this.metricRepository.clear();
  }
  // #endregion

  // #region Alerts
  async upsertStreamAlert(dto: UpsertStreamAlertDto): Promise<StreamAlertEntity> {
    const existing = await this.alertRepository.findOne({ where: { id: dto.id } });
    const entity = this.alertRepository.create({
      ...dto,
      timestamp: new Date(dto.timestamp),
    });
    const saved = await this.alertRepository.save(entity);
    if (existing) {
      this.realtimeGateway.broadcastEntityUpdated('streamAlert', saved);
    } else {
      this.realtimeGateway.broadcastEntityCreated('streamAlert', saved);
    }
    return saved;
  }

  async findAllAlerts(query: StreamAlertQueryDto): Promise<StreamAlertEntity[]> {
    const where: Record<string, any> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.type) where.type = query.type;
    if (query.acknowledged !== undefined) where.acknowledged = query.acknowledged;
    return this.alertRepository.find({
      where,
      order: { timestamp: 'DESC' },
    });
  }

  async findAlertById(id: string): Promise<StreamAlertEntity> {
    const entity = await this.alertRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Stream alert ${id} not found`);
    }
    return entity;
  }

  async findActiveAlerts(query: StreamAlertQueryDto): Promise<StreamAlertEntity[]> {
    return this.findAllAlerts({ ...query, acknowledged: false });
  }

  async acknowledgeAlert(id: string): Promise<StreamAlertEntity> {
    const alert = await this.findAlertById(id);
    if (!alert.acknowledged) {
      alert.acknowledged = true;
      alert.updatedAt = new Date();
      const saved = await this.alertRepository.save(alert);
      this.realtimeGateway.broadcastEntityUpdated('streamAlert', saved);
      return saved;
    }
    return alert;
  }

  async deleteAlert(id: string): Promise<void> {
    const existing = await this.alertRepository.findOne({ where: { id } });
    if (!existing) {
      return;
    }
    await this.alertRepository.delete(id);
    this.realtimeGateway.broadcastEntityDeleted('streamAlert', id);
  }
  // #endregion

  // #region Connection Configs
  async upsertConnectionConfig(dto: UpsertStreamConnectionConfigDto): Promise<StreamConnectionConfigEntity> {
    const existing = await this.connectionConfigRepository.findOne({ where: { id: dto.id } });
    const entity = this.connectionConfigRepository.create({
      ...dto,
      lastConnection: dto.lastConnection ? new Date(dto.lastConnection) : dto.lastConnection === null ? null : existing?.lastConnection ?? null,
    });
    const saved = await this.connectionConfigRepository.save(entity);
    if (existing) {
      this.realtimeGateway.broadcastEntityUpdated('streamConnectionConfig', saved);
    } else {
      this.realtimeGateway.broadcastEntityCreated('streamConnectionConfig', saved);
    }
    return saved;
  }

  async findAllConnectionConfigs(query: StreamConnectionConfigQueryDto): Promise<StreamConnectionConfigEntity[]> {
    const where: Record<string, any> = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.type) where.type = query.type;
    if (query.connectionStatus) where.connectionStatus = query.connectionStatus;
    if (query.enabled !== undefined) where.enabled = query.enabled;
    return this.connectionConfigRepository.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async findConnectionConfigById(id: string): Promise<StreamConnectionConfigEntity> {
    const entity = await this.connectionConfigRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`Stream connection config ${id} not found`);
    }
    return entity;
  }

  async deleteConnectionConfig(id: string): Promise<void> {
    const existing = await this.connectionConfigRepository.findOne({ where: { id } });
    if (!existing) {
      return;
    }
    await this.connectionConfigRepository.delete(id);
    this.realtimeGateway.broadcastEntityDeleted('streamConnectionConfig', id);
  }
  // #endregion

  // #region Bulk operations
  async exportAllData(query: StreamDataSourceQueryDto): Promise<{
    dataSources: StreamDataSource[];
    dataSinks: StreamDataSink[];
    streamProcessors: StreamProcessorEntity[];
    streamMetrics: StreamMetricEntity[];
    streamAlerts: StreamAlertEntity[];
    connectionConfigs: StreamConnectionConfigEntity[];
  }> {
    const scope = {
      tenantId: query.tenantId,
      organizationId: query.organizationId,
    };
    const scopedQuery = (repo: Repository<any>, extraWhere: Record<string, any> = {}) =>
      repo.find({
        where: Object.fromEntries(
          Object.entries({ ...scope, ...extraWhere }).filter(([, value]) => value !== undefined),
        ),
        order: { updatedAt: 'DESC' },
      });

    return {
      dataSources: await scopedQuery(this.dataSourceRepository),
      dataSinks: await scopedQuery(this.dataSinkRepository),
      streamProcessors: await scopedQuery(this.processorRepository, { order: undefined }),
      streamMetrics: await this.metricRepository.find({
        where: Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined)),
        order: { timestamp: 'DESC' },
      }),
      streamAlerts: await this.alertRepository.find({
        where: Object.fromEntries(Object.entries(scope).filter(([, value]) => value !== undefined)),
        order: { timestamp: 'DESC' },
      }),
      connectionConfigs: await scopedQuery(this.connectionConfigRepository),
    };
  }

  async importAllData(payload: ImportStreamingPayloadDto): Promise<void> {
    if (payload.dataSources?.length) {
      await Promise.all(payload.dataSources.map((item) => this.upsertDataSource(item)));
    }
    if (payload.dataSinks?.length) {
      await Promise.all(payload.dataSinks.map((item) => this.upsertDataSink(item)));
    }
    if (payload.streamProcessors?.length) {
      await Promise.all(payload.streamProcessors.map((item) => this.upsertStreamProcessor(item)));
    }
    if (payload.streamMetrics?.length) {
      await Promise.all(payload.streamMetrics.map((item) => this.saveStreamMetric(item)));
    }
    if (payload.streamAlerts?.length) {
      await Promise.all(payload.streamAlerts.map((item) => this.upsertStreamAlert(item)));
    }
    if (payload.connectionConfigs?.length) {
      await Promise.all(payload.connectionConfigs.map((item) => this.upsertConnectionConfig(item)));
    }
  }

  async clearAllData(scope?: { tenantId?: string; organizationId?: string }): Promise<void> {
    const where = Object.fromEntries(Object.entries(scope ?? {}).filter(([, value]) => value !== undefined));
    if (Object.keys(where).length === 0) {
      await Promise.all([
        this.dataSourceRepository.clear(),
        this.dataSinkRepository.clear(),
        this.processorRepository.clear(),
        this.metricRepository.clear(),
        this.alertRepository.clear(),
        this.connectionConfigRepository.clear(),
      ]);
    } else {
      await this.dataSourceRepository.delete(where);
      await this.dataSinkRepository.delete(where);
      await this.processorRepository.delete(where);
      await this.metricRepository.delete(where);
      await this.alertRepository.delete(where);
      await this.connectionConfigRepository.delete(where);
    }
  }
  // #endregion
}



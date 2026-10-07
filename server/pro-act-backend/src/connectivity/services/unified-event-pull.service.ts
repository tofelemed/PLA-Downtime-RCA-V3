import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PIEventPullService, PullEventsRequest, PullEventsResponse } from '../../integration/pi-event-pull.service';
import { SystemIntegration } from '../entities/system-integration.entity';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { ProductionEventService } from '../../production-event/production-event.service';
import { OPCUAConnection } from '../entities/opcua-connection.entity';
import { ModbusConnection } from '../entities/modbus-connection.entity';
import { MQTTConnection } from '../entities/mqtt-connection.entity';
import { DatabaseConnection } from '../entities/database-connection.entity';
import { RestApiConnection } from '../entities/restapi-connection.entity';
import { PIConnection } from '../../pi-connection/pi-connection.entity';

export interface UnifiedPullEventsRequest {
  sourceType: 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI' | 'SystemIntegration';
  sourceId: string; // Connection or integration ID
  tenantId: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  filters?: Record<string, any>;
  maxCount?: number;
  autoCreateProductionEvents?: boolean;
}

export interface UnifiedPullEventsResponse {
  success: boolean;
  sourceType: string;
  sourceId: string;
  eventsFetched: number;
  eventsStored: number;
  productionEventsCreated: number;
  productionEventsUpdated?: number;
  productionEventsSkipped?: number;
  unmappedEventsCreated?: number;
  errors: string[];
  events: any[];
  metadata?: Record<string, any>;
}

@Injectable()
export class UnifiedEventPullService {
  private readonly logger = new Logger(UnifiedEventPullService.name);

  constructor(
    private readonly piEventPullService: PIEventPullService,
    @InjectRepository(SystemIntegration)
    private readonly systemIntegrationRepository: Repository<SystemIntegration>,
    @InjectRepository(OPCUAConnection)
    private readonly opcuaConnectionRepository: Repository<OPCUAConnection>,
    @InjectRepository(ModbusConnection)
    private readonly modbusConnectionRepository: Repository<ModbusConnection>,
    @InjectRepository(MQTTConnection)
    private readonly mqttConnectionRepository: Repository<MQTTConnection>,
    @InjectRepository(DatabaseConnection)
    private readonly databaseConnectionRepository: Repository<DatabaseConnection>,
    @InjectRepository(RestApiConnection)
    private readonly restApiConnectionRepository: Repository<RestApiConnection>,
    @InjectRepository(PIConnection)
    private readonly piConnectionRepository: Repository<PIConnection>,
    private readonly productionEventService: ProductionEventService,
  ) {}

  /**
   * Unified method to pull events from any source
   */
  async pullEvents(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    this.logger.log(`Pulling events from ${request.sourceType} source: ${request.sourceId}`);

    switch (request.sourceType) {
      case 'PI':
        return await this.pullEventsFromPI(request);
      case 'OPCUA':
        return await this.pullEventsFromOPCUA(request);
      case 'Modbus':
        return await this.pullEventsFromModbus(request);
      case 'MQTT':
        return await this.pullEventsFromMQTT(request);
      case 'Database':
        return await this.pullEventsFromDatabase(request);
      case 'RESTAPI':
        return await this.pullEventsFromRESTAPI(request);
      case 'SystemIntegration':
        return await this.pullEventsFromSystemIntegration(request);
      default:
        throw new BadRequestException(`Unsupported source type: ${request.sourceType}`);
    }
  }

  /**
   * Pull events from PI system
   */
  private async pullEventsFromPI(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    const piRequest: PullEventsRequest = {
      tenantId: request.tenantId,
      startTimeUtc: request.startTimeUtc,
      endTimeUtc: request.endTimeUtc,
      scopeType: request.filters?.scopeType,
      scopeId: request.filters?.scopeId,
      templateName: request.filters?.templateName,
      maxCount: request.maxCount || 200,
      autoCreateProductionEvents: request.autoCreateProductionEvents !== false,
    };

    const response = await this.piEventPullService.pullEvents(piRequest);

    return {
      success: response.success,
      sourceType: 'PI',
      sourceId: request.sourceId,
      eventsFetched: response.eventsFetched,
      eventsStored: response.eventsStored,
      productionEventsCreated: response.productionEventsCreated,
      productionEventsUpdated: response.productionEventsUpdated,
      productionEventsSkipped: response.productionEventsSkipped,
      unmappedEventsCreated: response.unmappedEventsCreated,
      errors: response.errors,
      events: response.events,
      metadata: {
        scopeType: piRequest.scopeType,
        templateName: piRequest.templateName,
      },
    };
  }

  /**
   * Pull events from OPC UA
   */
  private async pullEventsFromOPCUA(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    const connection = await this.opcuaConnectionRepository.findOne({
      where: { id: request.sourceId, tenantId: request.tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`OPC UA connection ${request.sourceId} not found`);
    }

    // TODO: Implement OPC UA event pulling
    // For now, return placeholder
    this.logger.warn('OPC UA event pulling not yet implemented');
    
    return {
      success: false,
      sourceType: 'OPCUA',
      sourceId: request.sourceId,
      eventsFetched: 0,
      eventsStored: 0,
      productionEventsCreated: 0,
      errors: ['OPC UA event pulling not yet implemented'],
      events: [],
    };
  }

  /**
   * Pull events from Modbus
   */
  private async pullEventsFromModbus(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    const connection = await this.modbusConnectionRepository.findOne({
      where: { id: request.sourceId, tenantId: request.tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`Modbus connection ${request.sourceId} not found`);
    }

    // TODO: Implement Modbus event pulling
    this.logger.warn('Modbus event pulling not yet implemented');

    return {
      success: false,
      sourceType: 'Modbus',
      sourceId: request.sourceId,
      eventsFetched: 0,
      eventsStored: 0,
      productionEventsCreated: 0,
      errors: ['Modbus event pulling not yet implemented'],
      events: [],
    };
  }

  /**
   * Pull events from MQTT
   */
  private async pullEventsFromMQTT(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    const connection = await this.mqttConnectionRepository.findOne({
      where: { id: request.sourceId, tenantId: request.tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`MQTT connection ${request.sourceId} not found`);
    }

    // TODO: Implement MQTT event pulling
    this.logger.warn('MQTT event pulling not yet implemented');

    return {
      success: false,
      sourceType: 'MQTT',
      sourceId: request.sourceId,
      eventsFetched: 0,
      eventsStored: 0,
      productionEventsCreated: 0,
      errors: ['MQTT event pulling not yet implemented'],
      events: [],
    };
  }

  /**
   * Pull events from Database
   */
  private async pullEventsFromDatabase(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    const connection = await this.databaseConnectionRepository.findOne({
      where: { id: request.sourceId, tenantId: request.tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`Database connection ${request.sourceId} not found`);
    }

    // TODO: Implement Database event pulling
    this.logger.warn('Database event pulling not yet implemented');

    return {
      success: false,
      sourceType: 'Database',
      sourceId: request.sourceId,
      eventsFetched: 0,
      eventsStored: 0,
      productionEventsCreated: 0,
      errors: ['Database event pulling not yet implemented'],
      events: [],
    };
  }

  /**
   * Pull events from REST API
   */
  private async pullEventsFromRESTAPI(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    const connection = await this.restApiConnectionRepository.findOne({
      where: { id: request.sourceId, tenantId: request.tenantId },
    });

    if (!connection) {
      throw new NotFoundException(`REST API connection ${request.sourceId} not found`);
    }

    // TODO: Implement REST API event pulling
    this.logger.warn('REST API event pulling not yet implemented');

    return {
      success: false,
      sourceType: 'RESTAPI',
      sourceId: request.sourceId,
      eventsFetched: 0,
      eventsStored: 0,
      productionEventsCreated: 0,
      errors: ['REST API event pulling not yet implemented'],
      events: [],
    };
  }

  /**
   * Pull events from System Integration
   */
  private async pullEventsFromSystemIntegration(request: UnifiedPullEventsRequest): Promise<UnifiedPullEventsResponse> {
    const integration = await this.systemIntegrationRepository.findOne({
      where: { id: request.sourceId, tenantId: request.tenantId },
    });

    if (!integration) {
      throw new NotFoundException(`System integration ${request.sourceId} not found`);
    }

    // Route to appropriate handler based on integration type
    if (integration.integrationType === 'PI') {
      // Use PI connection ID if available in configuration
      const piConnectionId = integration.configuration?.piConnectionId;
      if (piConnectionId) {
        const piRequest: UnifiedPullEventsRequest = {
          ...request,
          sourceType: 'PI',
          sourceId: piConnectionId,
        };
        return await this.pullEventsFromPI(piRequest);
      }
    }

    // TODO: Implement other integration types
    this.logger.warn(`Event pulling for ${integration.integrationType} integration not yet implemented`);

    return {
      success: false,
      sourceType: 'SystemIntegration',
      sourceId: request.sourceId,
      eventsFetched: 0,
      eventsStored: 0,
      productionEventsCreated: 0,
      errors: [`Event pulling for ${integration.integrationType} integration not yet implemented`],
      events: [],
    };
  }

  /**
   * Get available sources for pulling events
   */
  async getAvailableSources(tenantId: string): Promise<any[]> {
    const sources: any[] = [];

    try {
      const piConnections = await this.piConnectionRepository.find({
        where: { tenantId, isActive: true },
      });
      sources.push(
        ...piConnections.map(conn => ({
          type: 'PI',
          id: conn.id,
          name: conn.connectionName,
          description: conn.afDatabasePath || conn.piWebApiUrl,
          enabled: conn.isActive,
          sourceType: 'PIConnection',
        })),
      );
    } catch (error) {
      this.logger.warn(`Failed to load pi_connections for tenant ${tenantId}: ${(error as Error).message}`);
    }

    try {
      const piIntegrations = await this.systemIntegrationRepository.find({
        where: { tenantId, integrationType: 'PI' },
      });
      sources.push(
        ...piIntegrations.map(conn => ({
          type: 'PI',
          id: conn.id,
          name: conn.name,
          description: conn.description,
          enabled: conn.enabled,
          sourceType: 'SystemIntegration',
        })),
      );
    } catch (error) {
      this.logger.debug(`system_integrations unavailable for tenant ${tenantId}: ${(error as Error).message}`);
    }

    await this.appendOptionalSources(sources, tenantId);
    return sources;
  }

  private async appendOptionalSources(sources: any[], tenantId: string): Promise<void> {
    try {
      const opcuaConnections = await this.opcuaConnectionRepository.find({ where: { tenantId } });
      sources.push(
        ...opcuaConnections.map(conn => ({
          type: 'OPCUA',
          id: conn.id,
          name: conn.name,
          description: null,
          enabled: conn.enabled,
          sourceType: 'OPCUA',
        })),
      );
    } catch (error) {
      this.logger.debug(`OPC UA sources skipped: ${(error as Error).message}`);
    }

    try {
      const modbusConnections = await this.modbusConnectionRepository.find({ where: { tenantId } });
      sources.push(
        ...modbusConnections.map(conn => ({
          type: 'Modbus',
          id: conn.id,
          name: conn.name,
          description: null,
          enabled: conn.enabled,
          sourceType: 'Modbus',
        })),
      );
    } catch (error) {
      this.logger.debug(`Modbus sources skipped: ${(error as Error).message}`);
    }

    try {
      const mqttConnections = await this.mqttConnectionRepository.find({ where: { tenantId } });
      sources.push(
        ...mqttConnections.map(conn => ({
          type: 'MQTT',
          id: conn.id,
          name: conn.name,
          description: null,
          enabled: conn.enabled,
          sourceType: 'MQTT',
        })),
      );
    } catch (error) {
      this.logger.debug(`MQTT sources skipped: ${(error as Error).message}`);
    }

    try {
      const dbConnections = await this.databaseConnectionRepository.find({ where: { tenantId } });
      sources.push(
        ...dbConnections.map(conn => ({
          type: 'Database',
          id: conn.id,
          name: conn.name,
          description: conn.description,
          enabled: conn.enabled,
          sourceType: 'Database',
        })),
      );
    } catch (error) {
      this.logger.debug(`Database sources skipped: ${(error as Error).message}`);
    }

    try {
      const restApiConnections = await this.restApiConnectionRepository.find({ where: { tenantId } });
      sources.push(
        ...restApiConnections.map(conn => ({
          type: 'RESTAPI',
          id: conn.id,
          name: conn.name,
          description: conn.description,
          enabled: conn.enabled,
          sourceType: 'RESTAPI',
        })),
      );
    } catch (error) {
      this.logger.debug(`REST API sources skipped: ${(error as Error).message}`);
    }
  }
}


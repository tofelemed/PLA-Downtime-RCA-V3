import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectivityController } from './connectivity.controller';
import { ConnectivityRealtimeController } from './connectivity-realtime.controller';
import { ConnectivityService } from './connectivity.service';
import { OPCUAConnection } from './entities/opcua-connection.entity';
import { ModbusConnection } from './entities/modbus-connection.entity';
import { EtherNetIPConnection } from './entities/ethernetip-connection.entity';
import { MQTTConnection } from './entities/mqtt-connection.entity';
import { BACnetConnection } from './entities/bacnet-connection.entity';
import { DNP3Connection } from './entities/dnp3-connection.entity';
import { ProfinetConnection } from './entities/profinet-connection.entity';
import { SCADAConnection } from './entities/scada-connection.entity';
import { WebSocketConnection } from './entities/websocket-connection.entity';
import { RestApiConnection } from './entities/restapi-connection.entity';
import { DatabaseConnection } from './entities/database-connection.entity';
import { SystemIntegration } from './entities/system-integration.entity';
import { DataBinding } from './entities/data-binding.entity';
import { DataTransformation } from './entities/data-transformation.entity';
import { ConnectionHealth } from './entities/connection-health.entity';
import { OPCUAService } from './services/opcua.service';
import { ModbusService } from './services/modbus.service';
import { EtherNetIPService } from './services/ethernetip.service';
import { MQTTService } from './services/mqtt.service';
import { BACnetService } from './services/bacnet.service';
import { DNP3Service } from './services/dnp3.service';
import { ProfinetService } from './services/profinet.service';
import { SCADAService } from './services/scada.service';
import { WebSocketService } from './services/websocket.service';
import { RestApiService } from './services/restapi.service';
import { DatabaseService } from './services/database.service';
import { SystemIntegrationService } from './services/system-integration.service';
import { DataBindingService } from './services/data-binding.service';
import { HealthMonitoringService } from './services/health-monitoring.service';
import { ProtocolManagerService } from './services/protocol-manager.service';
import { ConnectivityGateway } from './gateways/connectivity.gateway';
import { OPCUAClientService } from './services/opcua-client.service';
import { ModbusClientService } from './services/modbus-client.service';
import { MQTTClientService } from './services/mqtt-client.service';
import { EtherNetIPClientService } from './services/ethernetip-client.service';
import { UnifiedEventPullService } from './services/unified-event-pull.service';
import { ConnectionStatusHelperService } from './services/connection-status-helper.service';
import { IntegrationModule } from '../integration/integration.module';
import { ProductionEventModule } from '../production-event/production-event.module';
import { PIConnection } from '../pi-connection/pi-connection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PIConnection,
      OPCUAConnection,
      ModbusConnection,
      EtherNetIPConnection,
      MQTTConnection,
      BACnetConnection,
      DNP3Connection,
      ProfinetConnection,
      SCADAConnection,
      WebSocketConnection,
      RestApiConnection,
      DatabaseConnection,
      SystemIntegration,
      DataBinding,
      DataTransformation,
      ConnectionHealth,
    ]),
    IntegrationModule,
    ProductionEventModule,
  ],
  controllers: [ConnectivityController, ConnectivityRealtimeController],
  providers: [
    ConnectivityService,
    OPCUAService,
    ModbusService,
    EtherNetIPService,
    MQTTService,
    BACnetService,
    DNP3Service,
    ProfinetService,
    SCADAService,
    WebSocketService,
    RestApiService,
    DatabaseService,
    SystemIntegrationService,
    DataBindingService,
    HealthMonitoringService,
    ProtocolManagerService,
    ConnectivityGateway,
    OPCUAClientService,
    ModbusClientService,
    MQTTClientService,
    EtherNetIPClientService,
    UnifiedEventPullService,
    ConnectionStatusHelperService,
  ],
  exports: [
    ConnectivityService,
    OPCUAService,
    ModbusService,
    EtherNetIPService,
    MQTTService,
    BACnetService,
    DNP3Service,
    ProfinetService,
    SCADAService,
    WebSocketService,
    RestApiService,
    DatabaseService,
    SystemIntegrationService,
    DataBindingService,
    HealthMonitoringService,
    ProtocolManagerService,
    ConnectivityGateway,
    OPCUAClientService,
    ModbusClientService,
    MQTTClientService,
    EtherNetIPClientService,
    UnifiedEventPullService,
  ],
})
export class ConnectivityModule {}

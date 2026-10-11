# 🚀 Telegraf + Kafka + Containerization Architecture Proposal

## 📋 Overview

This document outlines the proposed architecture for using **Telegraf** as a data collection agent and **Apache Kafka** as a message streaming platform, all containerized using Docker for the ProAct connectivity infrastructure.

---

## 🎯 Why Telegraf + Kafka?

### **Current Architecture:**
```
Industrial Devices/Systems (OPC UA, Modbus, PI, etc.)
    ↓ (Direct connections)
Backend NestJS Services
    ↓
Database
```

### **Proposed Architecture with Telegraf + Kafka:**
```
Industrial Devices/Systems (OPC UA, Modbus, PI, etc.)
    ↓
Telegraf Agents (Containerized)
    ↓ (Publish to Kafka)
Kafka Message Broker (Containerized)
    ↓ (Consume)
Backend NestJS Services (Containerized)
    ↓
Database
```

---

## 🔌 What is Telegraf?

**Telegraf** is a plugin-driven server agent for collecting and reporting metrics and events from systems, sensors, and other data sources. It's part of the TICK stack (Telegraf, InfluxDB, Chronograf, Kapacitor).

### **Benefits for Connectivity:**

1. **Multi-Protocol Support:**
   - ✅ OPC UA input plugin
   - ✅ Modbus input plugin
   - ✅ MQTT input plugin
   - ✅ HTTP/REST API input plugin
   - ✅ Database query input plugin
   - ✅ Custom plugins available

2. **Lightweight & Fast:**
   - Written in Go (fast, efficient)
   - Low memory footprint
   - High throughput data collection

3. **Configuration-Based:**
   - TOML configuration files
   - Easy to deploy and manage
   - Version-controlled configurations

4. **Output Flexibility:**
   - Kafka output plugin (for streaming)
   - HTTP output plugin
   - Database output plugins
   - Multiple output destinations simultaneously

5. **No Code Required:**
   - Protocol connections configured via config files
   - No custom protocol implementation needed
   - Industry-standard solution

---

## 📨 What is Apache Kafka?

**Apache Kafka** is a distributed event streaming platform capable of handling trillions of events per day.

### **Benefits for Connectivity:**

1. **Scalability:**
   - Handle high-volume data streams
   - Distributed across multiple brokers
   - Horizontal scaling

2. **Reliability:**
   - Message persistence (durable storage)
   - Replication for fault tolerance
   - Exactly-once semantics

3. **Real-time Processing:**
   - Low latency message delivery
   - Real-time stream processing
   - Event sourcing capabilities

4. **Decoupling:**
   - Producers (Telegraf) and consumers (Backend) are decoupled
   - Multiple consumers can read same data
   - Easy to add new consumers

5. **Data Retention:**
   - Configurable retention policies
   - Replay capabilities
   - Historical data access

---

## 🏗️ Proposed Architecture

### **High-Level Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Industrial Layer                         │
│  OPC UA Servers | Modbus Devices | PI Systems | MQTT IoT   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Telegraf Agents (Docker Containers)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Telegraf     │  │ Telegraf     │  │ Telegraf     │     │
│  │ OPC UA Agent │  │ Modbus Agent │  │ PI Agent     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                            ▼                                │
│                   Kafka Producer Plugin                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Kafka Cluster (Docker Containers)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Kafka      │  │   Kafka      │  │   Zookeeper  │     │
│  │   Broker 1   │  │   Broker 2   │  │   (Optional) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  Topics:                                                    │
│  - opcua-data                                               │
│  - modbus-data                                              │
│  - pi-events                                                │
│  - mqtt-telemetry                                           │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend NestJS Services (Docker Container)          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Kafka Consumer Services                      │  │
│  │  - OPC UA Consumer                                    │  │
│  │  - Modbus Consumer                                    │  │
│  │  - PI Event Consumer                                  │  │
│  │  - MQTT Consumer                                      │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│                     ▼                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Event Processing & Transformation              │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│                     ▼                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        ProductionEvent Service                        │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              SQL Server Database (Container)                │
│           production_events, pi_events, etc.                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐳 Containerization Strategy

### **Containers Needed:**

1. **Telegraf Containers:**
   - One per protocol/source type (or combined)
   - Configuration mounted as volume
   - Lightweight, scalable

2. **Kafka Cluster:**
   - Kafka Broker containers (1-3 for redundancy)
   - Zookeeper container (or KRaft mode)
   - Kafka UI container (optional, for monitoring)

3. **Backend NestJS:**
   - Existing backend as container
   - Kafka client libraries
   - Consumer services

4. **Database:**
   - SQL Server container (or use existing)

### **Docker Compose Structure:**

```
docker-compose.yml
├── zookeeper (if needed)
├── kafka (1-3 brokers)
├── kafka-ui (optional monitoring)
├── telegraf-opcua
├── telegraf-modbus
├── telegraf-pi
├── telegraf-mqtt
├── backend (NestJS)
└── database (SQL Server)
```

---

## 📊 Data Flow Example

### **Example: OPC UA Data Collection**

1. **Telegraf OPC UA Agent:**
   - Connects to OPC UA server
   - Reads configured nodes periodically
   - Formats data as Kafka messages
   - Publishes to `opcua-data` topic

2. **Kafka:**
   - Receives messages in `opcua-data` topic
   - Stores with retention policy
   - Available for multiple consumers

3. **Backend Consumer:**
   - Subscribes to `opcua-data` topic
   - Processes messages in real-time
   - Transforms to production events
   - Stores in database

4. **Frontend:**
   - Receives real-time updates via WebSocket
   - Displays data in dashboards

---

## ✅ Benefits

### **1. Scalability:**
- ✅ Add more Telegraf agents without backend changes
- ✅ Scale Kafka brokers independently
- ✅ Scale consumers horizontally

### **2. Reliability:**
- ✅ Message persistence in Kafka
- ✅ Automatic failover
- ✅ No data loss during backend downtime

### **3. Performance:**
- ✅ Parallel data collection
- ✅ Non-blocking backend processing
- ✅ High throughput

### **4. Flexibility:**
- ✅ Easy to add new data sources
- ✅ Multiple consumers for same data
- ✅ Easy protocol additions

### **5. Decoupling:**
- ✅ Telegraf independent of backend
- ✅ Backend can be updated without affecting collection
- ✅ Easy to add new consumers

### **6. Operations:**
- ✅ Containerized = easy deployment
- ✅ Standardized configuration
- ✅ Easy monitoring and logging

---

## ⚠️ Considerations

### **Complexity:**
- More moving parts to manage
- Requires Kafka knowledge
- Container orchestration needed

### **Resource Usage:**
- Kafka requires more memory/disk
- Multiple containers = more resources
- Network overhead between containers

### **Deployment:**
- Need Docker/Docker Compose setup
- Container networking configuration
- Volume management for configs/data

### **Learning Curve:**
- Team needs to learn Telegraf config
- Kafka concepts (topics, partitions, consumers)
- Container orchestration

---

## 📦 What Would Be Containerized

### **1. Telegraf Containers:**

**OPC UA Telegraf:**
```dockerfile
FROM telegraf:latest
COPY telegraf-opcua.conf /etc/telegraf/telegraf.conf
```

**Configuration Example (`telegraf-opcua.conf`):**
```toml
[[inputs.opcua]]
  endpoint = "opc.tcp://localhost:4840"
  security_mode = "None"
  security_policy = "None"
  
  [[inputs.opcua.nodes]]
    name = "Temperature"
    namespace = "2"
    identifier_type = "i"
    identifier = "1001"

[[outputs.kafka]]
  brokers = ["kafka:9092"]
  topic = "opcua-data"
  data_format = "json"
```

**Modbus Telegraf:**
```toml
[[inputs.modbus]]
  name = "Modbus"
  controller = "tcp://modbus-device:502"
  
  [[inputs.modbus.holding_registers]]
    name = "Pressure"
    address = [0]
    data_type = "FLOAT32"

[[outputs.kafka]]
  brokers = ["kafka:9092"]
  topic = "modbus-data"
```

**PI Telegraf:**
```toml
[[inputs.exec]]
  commands = [
    "python3 /scripts/pull-pi-events.py"
  ]
  interval = "60s"
  data_format = "json"

[[outputs.kafka]]
  brokers = ["kafka:9092"]
  topic = "pi-events"
```

### **2. Kafka Cluster:**

**docker-compose.yml excerpt:**
```yaml
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
  
  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
  
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
```

### **3. Backend NestJS (with Kafka Consumer):**

**New Service Needed:**
```typescript
// kafka-consumer.service.ts
@Injectable()
export class KafkaConsumerService {
  private consumer: Consumer;
  
  async subscribeToOPCUAData() {
    await this.consumer.subscribe({ topic: 'opcua-data' });
    
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const data = JSON.parse(message.value.toString());
        // Process and create production events
      },
    });
  }
}
```

---

## 🔄 Migration Path

### **Phase 1: Setup Infrastructure (Week 1)**
1. Create Docker Compose file
2. Set up Kafka cluster
3. Create Telegraf containers
4. Test basic data flow

### **Phase 2: Integrate One Protocol (Week 2)**
1. Configure Telegraf for OPC UA (or Modbus)
2. Set up Kafka topic
3. Create backend consumer
4. Test end-to-end

### **Phase 3: Add More Protocols (Week 3)**
1. Add Modbus Telegraf
2. Add PI Telegraf
3. Add MQTT Telegraf
4. Multiple topics and consumers

### **Phase 4: Replace Existing (Week 4)**
1. Migrate existing connections
2. Remove direct protocol connections
3. Update frontend to use new flow
4. Full testing

---

## 💰 Resource Requirements

### **Kafka:**
- **Minimum**: 2GB RAM, 10GB disk per broker
- **Recommended**: 4GB RAM, 50GB disk per broker
- **CPU**: 2+ cores

### **Telegraf:**
- **Per container**: 100-500MB RAM
- **Disk**: Minimal (config files)
- **CPU**: Low (<1 core)

### **Total Estimated:**
- **Development**: 8GB RAM, 100GB disk
- **Production**: 16GB+ RAM, 500GB+ disk

---

## 🎯 Recommended Approach

### **Option 1: Full Telegraf + Kafka (Recommended for Production)**

**Pros:**
- ✅ Industry-standard solution
- ✅ Highly scalable
- ✅ Best performance
- ✅ Production-ready

**Cons:**
- ❌ More complex setup
- ❌ More resources needed
- ❌ Learning curve

**Best For:**
- Production deployments
- High-volume data
- Multiple data sources
- Long-term scalability

### **Option 2: Hybrid Approach (Recommended for Start)**

**Phase 1**: Keep existing direct connections + Add Kafka
- Use existing protocol services
- Add Kafka for streaming processed data
- Gradual migration

**Phase 2**: Add Telegraf for new protocols only
- Use Telegraf for new data sources
- Keep existing for current sources
- Test and validate

**Phase 3**: Full migration
- Migrate all to Telegraf + Kafka
- Remove direct connections
- Full containerization

**Best For:**
- Incremental adoption
- Lower risk
- Gradual learning

### **Option 3: Telegraf Only (Simpler)**

**Architecture:**
```
Telegraf → HTTP Output → Backend API → Database
```

**Pros:**
- ✅ Simpler than Kafka
- ✅ Still get Telegraf benefits
- ✅ Less infrastructure

**Cons:**
- ❌ Less scalable
- ❌ No message queuing
- ❌ Direct coupling

---

## 📝 Configuration Management

### **Telegraf Configs (Version Controlled):**
```
/telegraf-configs/
  ├── opcua/
  │   ├── telegraf.conf
  │   └── device-mappings.yaml
  ├── modbus/
  │   ├── telegraf.conf
  │   └── register-mappings.yaml
  └── pi/
      ├── telegraf.conf
      └── pi-query-config.yaml
```

### **Kafka Topics:**
- `opcua-data` - OPC UA sensor data
- `modbus-data` - Modbus register data
- `pi-events` - PI event frames
- `mqtt-telemetry` - MQTT IoT device data
- `production-events` - Processed production events
- `alerts` - System alerts and notifications

---

## 🔧 Integration Points

### **Backend Changes Needed:**

1. **Add Kafka Client:**
   ```bash
   npm install kafkajs
   ```

2. **Create Consumer Service:**
   - Subscribe to Kafka topics
   - Process messages
   - Create production events

3. **Keep Existing Services:**
   - Can coexist during migration
   - Gradually switch over

4. **New Endpoints (Optional):**
   - Kafka topic management
   - Consumer group management
   - Message replay endpoints

---

## 📊 Monitoring & Observability

### **Kafka Monitoring:**
- Kafka UI (web interface)
- JMX metrics
- Topic/partition health
- Consumer lag monitoring

### **Telegraf Monitoring:**
- Telegraf internal metrics
- Collection success/failure rates
- Output plugin metrics

### **Integration:**
- Prometheus + Grafana for metrics
- ELK Stack for logs
- Custom dashboards

---

## 🚀 Quick Start (When Ready)

### **1. Create Docker Compose:**
```yaml
version: '3.8'
services:
  kafka:
    image: confluentinc/cp-kafka:latest
    # ... config
    
  telegraf-opcua:
    image: telegraf:latest
    volumes:
      - ./telegraf-configs/opcua:/etc/telegraf
    # ... config
```

### **2. Configure Telegraf:**
- Create config files
- Map to Kafka topics
- Test connections

### **3. Add Backend Consumer:**
- Install kafkajs
- Create consumer service
- Process messages

### **4. Test:**
- Start containers
- Verify data flow
- Monitor Kafka UI

---

## ⚡ Performance Expectations

### **Telegraf:**
- **Throughput**: 100k+ metrics/second per agent
- **Latency**: <10ms per collection cycle
- **Resource**: <500MB RAM per agent

### **Kafka:**
- **Throughput**: Millions of messages/second
- **Latency**: <5ms (99th percentile)
- **Retention**: Configurable (hours to days)

### **End-to-End:**
- **Collection → Kafka**: <50ms
- **Kafka → Backend**: <100ms
- **Backend → Database**: <200ms
- **Total**: <350ms from source to storage

---

## 🎯 Recommendations

### **✅ Recommended:**

1. **Start with Hybrid Approach:**
   - Keep existing connections
   - Add Kafka for new sources
   - Migrate gradually

2. **Use Telegraf for:**
   - OPC UA (excellent plugin support)
   - Modbus (great plugin)
   - MQTT (native support)
   - PI (via exec/HTTP plugins)

3. **Containerize Everything:**
   - Docker Compose for development
   - Kubernetes for production
   - Easy deployment and scaling

4. **Start Small:**
   - One protocol first (OPC UA or Modbus)
   - Validate architecture
   - Expand gradually

### **📋 Implementation Checklist:**

- [ ] Design Kafka topic structure
- [ ] Create Docker Compose file
- [ ] Set up Kafka cluster
- [ ] Create Telegraf configs
- [ ] Build Telegraf containers
- [ ] Add Kafka consumer to backend
- [ ] Test with one protocol
- [ ] Add monitoring
- [ ] Document procedures
- [ ] Plan migration strategy

---

## 📚 Resources Needed

### **Technologies:**
- Docker & Docker Compose
- Apache Kafka
- Telegraf
- KafkaJS (Node.js library)
- Kafka UI (monitoring tool)

### **Knowledge:**
- Kafka concepts (topics, partitions, consumers)
- Telegraf configuration
- Docker containerization
- Event-driven architecture

---

## 🎬 Next Steps (When Ready to Start)

1. **Review & Approve Architecture**
2. **Create Docker Compose File**
3. **Set Up Development Environment**
4. **Create First Telegraf Config**
5. **Test Basic Data Flow**
6. **Integrate with Backend**
7. **Expand to Other Protocols**

---

**Status**: 📋 Architecture proposal ready for review  
**Next**: Awaiting approval before implementation

---

## ❓ Questions to Consider

1. **Infrastructure:**
   - Do you have Docker environment ready?
   - What are resource constraints?
   - Cloud or on-premises?

2. **Scope:**
   - Start with one protocol or all?
   - Full replacement or hybrid?
   - Timeline expectations?

3. **Operations:**
   - Who will manage containers?
   - Monitoring requirements?
   - Backup/recovery strategy?

---

**Ready to proceed when you approve!** 🚀


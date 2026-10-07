
The Proactive Production-Intelligence Platform: A Vision & Architecture Specification for a Next-Generation PLA System


Part 1: Vision, Strategy, and Core Domain Model


1.1 The Mandate: From Reactive Accounting to Proactive Optimization

The existing documentation for the current Production Loss Analysis (PLA) module 1 describes a system of record that is fundamentally reactive and accounting-driven. The primary workflow, as detailed in its documentation, begins after production is complete: a user enters Production Data, the system calculates a discrepancy termed Unaccounted Loss, and an analyst must then manually investigate and reconcile this loss by creating or linking a Production Event.1 In this model, the event is a subordinate object, created only to justify a pre-calculated financial discrepancy.
This specification outlines a strategic and architectural inversion of that paradigm. The futuristic platform described herein is designed to be proactive and event-driven. This "Event-First" paradigm shift positions Production Events as first-class citizens and the central trigger for all subsequent analysis. Events are not created to explain loss; events occur, and the system automatically quantifies their impact as loss.
This system moves from manual accounting to automated, contextualized analysis. The workflow is inverted:
An Event occurs, captured from its source (e.g., an Aveva PI Event Frame, a user-defined logic breach, or a predictive AI model).2
The system immediately creates a ProductionLoss record, automatically linking it to the causal Event.
The system leverages its knowledge of ProductionProfiles and ProductionPlans to quantify the impact of this event in real-time.
When ProductionData for the period is entered or streamed, the system already possesses a fully contextualized ledger of loss events to apply, rather than presenting a simple Unaccounted Loss figure.
This "AI by design" mandate is not a supplemental feature but a foundational component woven into the three core processes of the platform:
Prediction: Leveraging machine learning models to analyze real-time sensor data, enabling the detection of anomalies before they escalate into significant, loss-causing events.4
Classification: Employing AI to automatically categorize and classify events and their associated losses (e.g., assigning OEE, Impact, and Event codes).6 This minimizes the manual data entry and reconciliation burden that defines the current system.
Causality: Utilizing an intelligent Root Cause Analysis (RCA) engine that combines Knowledge Graphs with Causal Bayesian Networks to discover the true root causes of events, moving far beyond simple correlation or manual 5-Why exercises.7

1.2 The Core Domain Model: A Unified Manufacturing Ontology

To achieve this interconnected vision, a unified domain model is required. This model serves as the "ubiquitous language" for the entire microservice ecosystem and provides the foundational ontology for the Knowledge Graph. It is an evolution of the entities identified in the current system documentation 1 and the frontend specification.9
Site/Enterprise: The root entity, representing the organization, corporation, or physical plant.
AssetHierarchy (ProductionUnit): A critical, recursive structure representing the physical plant. This entity models the relationships between assets (e.g., a Site contains Units, a Unit contains Lines, a Line contains Machines, a Machine contains Components). This is essential for contextualizing events, rolling up losses, and performing causal analysis.1
SensorTag / PI-Tag: The digital representation of a single time-series data point from an industrial historian (e.g., Aveva PI, OPC servers). This is the source of all raw data.
Product: The material or item being manufactured.1
ProductionProfile: Defines the productive capability of an Asset (or ProductionUnit) to create a specific Product. It stores critical parameters like Maximum Sustained Capacity Rate (MSCR) and Planning Rate.1
ProductionPlan: The time-based or quantity-based schedule defining the intended production for an Asset over a set period, including any planned downtime.1
ProductionData: The record of actual production output over a discrete period (e.g., a shift, hour, or day), as well as the reconciled losses associated with that period.1
EventRule: A new, critical entity representing a user-defined logical statement. This is the technical implementation of the "create event logic" requirement. It is a persisted set of conditions (e.g., "IF Tag-101.Value > 90 AND Average(Tag-202.Value, 5m) < 50 THEN CREATE 'Overheat Event'").
ProductionEvent: The central entity of the "Event-First" paradigm. This is any occurrence—planned or unplanned—that impacts, or has the potential to impact, production. To support the new intelligent workflows, this entity must be sub-typed:
ManualEvent: An event created manually by an operator or engineer, as per the current system's capability.1
SystemEvent: An event ingested from a qualified external system. The prime example is an Aveva PI Event Frame, which arrives with a start time, end time, and associated asset context.2
InferredEvent: An event generated automatically by the Complex Event Processing (CEP) Service when streaming tag data breaches a user-defined EventRule.3
PredictedEvent: A pre-failure anomaly or deviation from "normal" operating behavior, as identified by a predictive AI model before it constitutes a traditional failure.4
ProductionLoss: The quantified impact (in units of mass, volume, time, or cost) of a ProductionEvent.1 In the new paradigm, a ProductionLoss record is caused by one or more ProductionEvents.
RCAAnalysis (Root Cause Analysis): The formal investigation record, linking one or more ProductionEvents (symptoms) to their identified root causes. This entity tracks the state, team, and outcome of the analysis.1
CausalHypothesis / CausalRelationship: A new entity representing a learned, probabilistic, causal link (e.g., "Event A has an 80% probability of causing Event B") discovered by the Causal Bayesian Network (CBN) engine, or a deterministic link ("Asset X is upstream of Asset Y") defined by the Knowledge Graph.8

Part 2: System Architecture: A Resilient, Event-Driven Microservice Ecosystem


2.1 The "PLA-360" Microservice Blueprint

The architecture specified is a distributed system of microservices. This approach is fundamental to achieving the user's requirements for scalability, resilience, and security.12 In contrast to a monolithic system, a microservice architecture allows for the independent development, deployment, and scaling of each component of business functionality.14 For example, the computationally intensive Predictive Analytics Service can be scaled independently of the Master Data Service.
This blueprint aligns with modern practices for complex industrial systems 15 and is organized into four logical domains, which will be detailed in the following sections:
Core Services: The modernized "accounting" and "admin" functions from the current system.1
Ingestion & Processing Services: The real-time data ingestion and event-generation pipelines.
Intelligence Services: The AI, ML, and Knowledge Graph/RCA "brains" of the platform.
Foundational Services: The cross-cutting, non-functional backbone for security, routing, and deployment.

2.2 The Central Nervous System: An Event-Driven Backbone

All asynchronous, inter-service communication must be mediated by a durable, high-throughput, distributed message bus. The specification for this backbone is Apache Kafka.14
A direct, synchronous HTTP-call (REST) architecture between services is explicitly forbidden for asynchronous workflows. A service-to-service REST call creates tight coupling; if the called service is down, the calling service fails, leading to cascading failures.
The Kafka-based event-driven architecture provides three critical advantages:
True Decoupling: Services do not know about each other; they only produce and consume events from Kafka topics. The Historian Integration Service produces a raw-tag-data event. The CEP Service, Predictive Analytics Service, and Knowledge Graph Service all consume this event independently, without the Historian Service even knowing they exist.
Extreme Resilience: If the AI Reconciliation Service (a consumer) crashes, data is not lost. The events (produced by other services) simply queue in the Kafka topic. When the service is restarted, it resumes processing the backlog from its last known offset. This ensures no data loss during service outages.
Data Replayability: A new or retrained AI model can be validated by replaying the entire history of the industrial.historian.tags.streaming topic, allowing for robust back-testing against real-world data.
Key Kafka topics for this architecture will include:
platform.masterdata.products.updated
platform.masterdata.codes.updated
platform.masterdata.assets.updated
industrial.historian.pi.eventframes.created
industrial.historian.tags.streaming
industrial.cep.events.inferred
platform.ai.events.predicted
platform.production.losses.created_unreconciled
platform.ai.reconciliation.classified
platform.rca.analysis.completed

2.3 Orchestration & Deployment: A Kubernetes-Native Foundation

All microservices specified in this document must be containerized (e.g., Docker) and deployed on a Kubernetes (K8s) cluster.15 This is a foundational requirement for achieving the mandated scalability and resilience.
Kubernetes provides the runtime environment for the entire platform:
Autonomous Scalability: Services that are computationally intensive, such as the CEP Service (processing millions of tag data points per second) or the Intelligent RCA Service (running complex graph algorithms), can be configured with Horizontal Pod Autoscalers (HPAs). K8s will automatically add more instances (pods) of these services as load increases.
Resilience & Self-Healing: K8s constantly monitors the health of all running containers. If an instance of the Production Planning Service crashes due to an unhandled exception, K8s will automatically detect its failure and restart it, often with no human intervention.
Deployment & Portability: This architecture is cloud-agnostic. The entire K8s-based platform can be deployed on a public cloud (AWS EKS, Azure AKS, Google GKE), on-premise (e.g., OpenShift, Rancher), or in air-gapped industrial environments, fulfilling a key requirement for manufacturing software.
This approach allows for independent, agile teams to manage their own services, aligning with modern DevOps practices.12

2.4 The API-First Gateway: The System's Front Door

A single, central API Gateway (e.g., NGINX, Kong, or a managed service like Azure Application Gateway) must be the unified entry point for all external traffic.19 This includes the browser-based frontend application 9 and any external systems pushing data, such as the Aveva PI system's Web API notifications.10
Directly exposing individual microservices to the external network is forbidden. The API Gateway is a critical component for security and management 18:
Request Routing: It acts as a reverse proxy. A request from the frontend to POST /api/v1/plans is received by the Gateway, which then routes it to the correct internal service (production-planning-service.platform.svc.cluster.local:8080). The frontend has no knowledge of the internal service's name or location.
Edge Security: The Gateway is the primary security enforcement point. It is responsible for terminating TLS (HTTPS), validating the user's authentication token (e.g., OAuth2 JWT) on every single request, and enforcing coarse-grained authorization (e.g., "Is this user allowed to access the /api/v1/admin path?").
Cross-Cutting Concerns: It offloads common tasks from the microservices, such as rate limiting, request/response logging, and CORS policy enforcement.

Part 3: Core Microservice Specifications (The "Accounting" Foundation)

This domain of services represents the modernized, service-oriented implementation of the core functionality described in the Production_Loss_Analysis.pdf.1 They provide the foundational "system of record" capabilities upon which the intelligent services are built.

3.1 Service: Production Planning & Profile Service

Domain: This service is the sole owner and system of record for the ProductionPlan, PlanTemplate, and ProductionProfile entities.
Function: It provides all CRUD operations and business logic for creating, managing, approving, and tracking production plans. It manages the templates used to generate new plans 1 and the production profiles that define the capabilities of assets.1
Key API Endpoints (Synchronous, via API Gateway):
POST /api/v1/plans/build: Create a new plan using the Production Plan Builder.1
POST /api/v1/plans/template: Create a new plan from a template.1
POST /api/v1/plans/manual: Create a manual plan.1
GET /api/v1/plans/{id}: Retrieve a single plan's details.1
GET /api/v1/plans/{id}/summary: Access the production summary for a plan.1
POST /api/v1/plans/{id}/submit: Submit a plan for review (if State Management is enabled).1
POST /api/v1/plans/{id}/approve: Approve a plan.1
GET /api/v1/admin/profiles: List all Production Profiles.
POST /api/v1/admin/profiles: Create a new Production Profile.1
GET /api/v1/admin/templates: List all Plan Templates.1
Data Storage: A dedicated relational database (e.g., PostgreSQL) to store the plan and profile records.
Event Dependencies (Asynchronous):
Consumes (Kafka): platform.masterdata.products.updated, platform.masterdata.assets.updated. This service listens for updates from the Master Data Service to ensure its internal data (e.g., product lists for plans) is consistent.
Produces (Kafka): platform.planning.plans.created, platform.planning.profiles.updated.

3.2 Service: Production Data & Reconciliation Service

Domain: This service is the sole owner of the ProductionData and ProductionLoss entities.
Function: It manages the entry of actual production data and handles the logic for loss reconciliation. This service is the primary recipient of the new automated workflows. It must support both the legacy manual workflow and the new automated, event-first workflow.
Key API Endpoints (Synchronous, via API Gateway):
GET /api/v1/plans/{planId}/production-data: Access the production data records for a plan.1
PUT /api/v1/production-data/{dataId}: Modify a production data record (e.g., update the Actual or Short Range Plan value).1
POST /api/v1/production-data/{dataId}/losses: (Manual Workflow) Manually create a new ProductionLoss to reconcile an unaccounted loss.1
POST /api/v1/losses/{lossId}/link-event: (Manual Workflow) Manually link an existing ProductionEvent to a ProductionLoss.1
POST /api/v1/losses/bulk-reconcile: (Manual Workflow) Perform bulk data entry and loss reconciliation.1
Data Storage: A dedicated database (relational or time-series, e.g., TimescaleDB) optimized for storing periodic production data and loss records.
Event Dependencies (Asynchronous):
Consumes (Kafka): industrial.historian.pi.eventframes.created, industrial.cep.events.inferred, platform.ai.events.predicted.
Workflow: When any of these ProductionEvents are received, this service automatically creates a new ProductionLoss record. It links the EventID as the cause and calculates the loss amount based on the event's duration and the asset's ProductionProfile. The loss is initially marked as "Unreconciled."
Consumes (Kafka): platform.ai.reconciliation.classified.
Workflow: When the AI Reconciliation Service (Part 4.5) classifies a loss, this service consumes the message, updates the corresponding ProductionLoss record with the AI-provided EventCode, OEECode, and ImpactCode, and marks its status as "Reconciled."
Produces (Kafka): platform.production.losses.created_unreconciled (when a new loss is created, either manually or via an event), platform.production.data.updated.

3.3 Service: Master Data Service

Domain: This service is the central, immutable system of record for all foundational administrative entities. This includes Product, Code (Impact, OEE, Event), ProductionUnit (AssetHierarchy), and other system-wide configurations.1
Function: Provides CRUD operations for all administrative data, ensuring data consistency and integrity across the entire platform. The frontend's AdminPanel 9 interacts almost exclusively with this service.
Key API Endpoints (Synchronous, via API Gateway):
GET /api/v1/admin/products: CRUD for Products.1
GET /api/v1/admin/codes: CRUD for all code types (Impact, OEE, Event).1
GET /api/v1/admin/units: CRUD for Production Units / Asset Hierarchy.1
GET /api/v1/admin/settings: Manage system settings like currency and precision.1
Data Storage: A dedicated relational database (e.g., PostgreSQL).
Event Dependencies (Asynchronous):
Produces (Kafka): platform.masterdata.products.updated, platform.masterdata.codes.updated, platform.masterdata.assets.updated. This service is the "source of truth." When an admin creates a new Product, this service publishes that change. All other services (like Planning and KG) consume this topic to update their local caches/views, ensuring eventual consistency.

Part 4: The Intelligent Core: Ingestion & "AI by Design"

This domain of services fulfills the "futuristic" requirements of the user query. These services are responsible for data ingestion from industrial systems, real-time event generation (both logic-based and AI-based), and the automated classification of production losses.

4.1 Service: Historian Integration Service

Domain: This service is the sole "gateway" to all Operational Technology (OT) data systems. It abstracts the complexity of industrial protocols and APIs from the rest of the platform.
Function:
Event Ingestion (Push): Exposes a secure REST endpoint (e.g., POST /api/v1/ingest/aveva/eventframe). This endpoint is designed to be a target for the Aveva PI system's native "Notifications" capability, which can POST Event Frame data via a Web API (similar to the integration pattern for AVEVA Production Management).10 This is the primary mechanism for ingesting SystemEvents.
Event Ingestion (Pull): Provides a polling mechanism for legacy historians that do not support push notifications.
Time-Series Ingestion: Maintains persistent, high-throughput subscription connections to PI and OPC UA servers to stream raw SensorTag data in real-time.
Data Storage: No persistent storage. This is a stateless gateway service.
Event Dependencies (Asynchronous):
Produces (Kafka): industrial.historian.pi.eventframes.created. This topic carries the full context of the Aveva Event Frame (Asset, Start Time, End Time, Attributes).2
Produces (Kafka): industrial.historian.tags.streaming. This is a very high-velocity topic containing the raw tag data stream (e.g., { "tag": "TIC-101", "timestamp": "...", "value": 150.2 }).

4.2 Service: Complex Event Processing (CEP) Service (The "Event Horizon" Engine)

Domain: This is the real-time pattern-matching "brain" of the platform. It directly fulfills the user's mandate to "create event logic based on the tags from realtime data."
Function: It consumes the high-velocity SensorTag stream and applies a dynamic, user-defined ruleset to detect complex patterns, generating new InferredEvents.
Core Technology Specification: Apache Flink
This service must be built on Apache Flink. It must not be built on Apache Spark Structured Streaming.21
Rationale:
True Stream vs. Micro-batch: Flink is a true, event-by-event stream processing engine.21 Spark Streaming uses a micro-batch model.22 For real-time industrial alerting (e.g., "Stop the line now"), the millisecond-level latency of Flink is a requirement; the sub-second-to-seconds latency of Spark is unacceptable.21
Stateful Processing: Industrial logic is almost always stateful (e.g., "average temp over 5 minutes," "sensor value rising for 10 consecutive seconds").3 Flink's native, robust support for stateful stream processing and Complex Event Processing (CEP) libraries is vastly superior to Spark's, which is more limited.22 Flink is built for this exact use case.25
Workflow:
Consumes (Kafka): industrial.historian.tags.streaming.
Consumes (Kafka): platform.rules.definitions.updated. This topic is used to dynamically update its in-memory ruleset (see Part 4.3).
The Flink job applies the full set of active EventRule definitions to the streaming tag data using its CEP operators.
When a pattern is matched (a rule is breached), it Produces (Kafka) a new ProductionEvent: industrial.cep.events.inferred (an InferredEvent).

4.3 Service: The "Event Logic" Rules Engine Service

Domain: This service is the user-facing "low-code" platform for defining and managing the EventRule entities. It does not execute the rules; it manages them.
Function: It provides the API and persistence layer for the EventRule definitions that the CEP Service consumes. It empowers production engineers, not developers, to create and manage event logic.26
Specification: This service will manage rules as structured JSON/YAML documents, abstracting the business logic from the core application code.28 The frontend 9 will feature a visual rule builder (e.g., using "blockly" or a similar interface) that allows an engineer to build a rule like:
Name: 'C-101 High Temp Warning'
Severity: 'Warning'
Logic: (Tag-101.Value > 100 OR Tag-102.Value == 'Active') AND (Average(Tag-201.Value, 5m) < 50)
The "Hot-Deploy" Workflow:
An engineer uses the frontend to build or modify an EventRule.
The frontend calls POST /api/v1/admin/rules on the Rules Engine Service.
This service validates the rule, saves it to its database, and then Produces (Kafka) a message on the platform.rules.definitions.updated topic, containing the full JSON/YAML definition of the new or updated rule.
The CEP Service (Flink) (Part 4.2) is a consumer of this topic. Upon receiving the message, it dynamically updates its in-memory rule set without restarting the Flink job.
This event-driven pattern creates a robust "hot-deploy" mechanism, allowing for real-time updates to production logic, a critical operational requirement.26

4.4 Service: Predictive Analytics Service (The "Anomaly" Detector)

Domain: This service hosts and executes the platform's predictive AI/ML models for anomaly detection and predictive maintenance.
Function: To analyze time-series SensorTag data in real-time, identify deviations from "normal" operation, and generate PredictedEvents before a failure occurs.
Core Technology Specification: This service will be a dedicated model-hosting platform built on Kubernetes (e.g., using Kubeflow, Seldon Core, or a custom Python/FastAPI implementation). It must be capable of running multiple, competing model architectures 11:
LSTM (Long Short-Term Memory) Autoencoders: For complex, multivariate anomaly detection. These models are trained on historical data of an asset's "normal" operation (learning the complex relationships between hundreds of tags) and then flag any new data that doesn't fit this "normal" signature.11
Isolation Forests: A lighter-weight, non-neural-network model that is highly effective at identifying anomalies in high-dimensional data.11
One-Class SVM (Support Vector Machine): A robust model for defining a boundary around "normal" data and identifying outliers.11
Workflow:
Consumes (Kafka): industrial.historian.tags.streaming.
The service (or its deployed models) consumes this stream and performs real-time inference.
When a model flags a statistically significant anomaly (a PredictedEvent), it Produces (Kafka) a message: platform.ai.events.predicted. This message includes the asset, the timestamp, the sensors involved, and a confidence score.

4.5 Service: AI Reconciliation Service (The "Auto-Classifier")

Domain: This service automates the most time-consuming manual workflow of the current system: reconciling losses by assigning EventCodes, ImpactCodes, and OEECodes.
Function: It consumes unreconciled ProductionLoss events and uses AI models to automatically determine and assign the correct classification codes.
Core Technology Specification: This service is a hybrid-model system:
Natural Language Processing (NLP) Engine: For ProductionEvents that contain operator comments, this component uses NLP models (e.g., BERT-based classifiers or simpler text analytics) to perform sentiment analysis and entity extraction. It can parse text like "C-101 bearing failure, maintenance called" to automatically suggest EventCode: 'Equipment Breakdown' and ImpactCode: 'Unscheduled Downtime'.30
Machine Learning Classification Engine: For ProductionEvents with no text (e.g., InferredEvent, SystemEvent), this component uses classification models trained on historical sensor and alarm data. Models like Random Forest, Decision Trees, and XGBoost are highly effective at this. For example, the model learns that a specific pattern of alarms and sensor readings (e.g., Alarm-A + Alarm-B + Tag-101.Value > 90) is 95% likely to be a "No Material" downtime event.6
Workflow:
Consumes (Kafka): platform.production.losses.created_unreconciled.
When a message arrives, it retrieves the full context (e.g., operator logs, associated sensor data from the historian).
It runs the data through the appropriate model (NLP or ML Classification).
It Produces (Kafka): a platform.ai.reconciliation.classified message, containing the LossID, the suggested codes, and a confidence score for the classification.

Part 5: The Contextual Core: The Manufacturing Knowledge Graph

This domain delivers the "Knowledge Graph" and "super expert RCA" mandates. It provides the "context of the application" by fusing the domain model with causal relationships, enabling a level of analysis impossible in a traditional relational database.

5.1 Service: Knowledge Graph Service (The "Context" Engine)

Domain: This service is the central repository for all system context and relationships. It is the "brain" that connects all the disparate entities from other services.
Function:
Persistence: It stores and manages the graph ontology (all nodes and relationships).
Querying: It exposes a rich query API (e.g., GraphQL or a Cypher-over-REST endpoint) that allows the frontend 9 and other services to perform complex, multi-domain graph traversals.
Core Technology Specification: Property Graph Database
This service must be built on a native Property Graph Database, with Neo4j being the recommended implementation.33
Rationale: A relational database (SQL) is optimized for storing rows of data. A graph database is optimized for storing and traversing relationships.34 A query like, "Find all ProductionPlans affected by ProductionEvents that were caused by Assets that are downstream of Machine-XYZ and which share a RootCause with an event from last week" is virtually impossible in SQL but is a trivial and high-performance Cypher query in Neo4j.
Workflow (Graph Hydration):
This service is a "super-consumer." It Consumes (Kafka) events from all other services (e.g., platform.masterdata.assets.updated, industrial.cep.events.inferred, platform.planning.plans.created, platform.rca.analysis.completed).
As these events arrive, this service performs "graph hydration" in near-real-time. An industrial.cep.events.inferred message causes it to create a new :ProductionEvent node and link it (OCCURRED_AT) to the correct :Asset node. A platform.rca.analysis.completed message causes it to create :CausalHypothesis nodes and link them to the event. This workflow ensures the KG always has the complete, up-to-the-second context of the application.

5.2 The Manufacturing Ontology: A Detailed Property Graph Model

The following table defines the property graph data model (the ontology) for the Knowledge Graph. This schema is the intellectual property that enables all contextual and causal analysis.35
Node Label
Properties (Example)
Relationship (Edge)
Target Node
Description
Site
name, location
CONTAINS_ASSET
Asset
Represents a physical plant or enterprise.
Asset
name, type: ['Unit', 'Line', 'Machine']
HAS_CHILD_ASSET
Asset
Models the physical asset hierarchy.
Asset
maintPriority
IS_UPSTREAM_OF
Asset
Causal Prior: Defines process flow.
Asset
assetId
HAS_NO_IMPACT_ON
Asset
Causal Prior: Explicit expert knowledge.
Asset
assetId
HAS_TAG
SensorTag
Links physical asset to digital tags.
Asset
assetId
SCHEDULED_ON
ProductionPlan
Links asset to its production schedule.
SensorTag
tagId, description, uom
MEASURES
Asset
Defines which tag measures which asset.
Product
productCode, description
PRODUCED_BY
ProductionProfile
Links a product to its manufacturing profile.
ProductionProfile
maxRate, planningRate
APPLIES_TO
Asset
Defines the capability of an asset.
ProductionPlan
planId, startDate, endDate, status
DEFINES_TARGET_FOR
ProductionData
Links the plan to the actual data.
ProductionData
periodStart, periodEnd, actualQty
AGGREGATES
ProductionLoss
Links a time period to all losses within it.
ProductionEvent
eventId, type:
OCCURRED_AT
Asset
Context: Links event to a physical asset.
ProductionEvent
startTime, endTime, confidence
AFFECTED
Product
Context: Links event to product being run.
ProductionEvent
description
CAUSED
ProductionLoss
Core: Links the event to its impact.
ProductionLoss
lossAmount, cost, status:
ASSOCIATED_WITH
ProductionData
Links the loss back to its accounting period.
ProductionLoss
lossId
CLASSIFIED_BY
Code
Links a loss to its OEE, Impact, or Event code.
Code
codeId, type: ['OEE', 'Impact', 'Event']
IS_CHILD_OF
Code
Models the hierarchy of codes.
RCAAnalysis
analysisId, status: ['Open', 'Closed']
INVESTIGATES
ProductionEvent
Links an investigation to its trigger event.
RCAAnalysis
summary
IDENTIFIED
CausalHypothesis
Links analysis to its findings.
CausalHypothesis
probability, type:
IS_ROOT_CAUSE_OF
ProductionEvent
Causality: The finding of the RCA.
CausalHypothesis
description
CAUSED_BY
Asset
Causality: The ultimate physical root cause.


5.3 Service: Intelligent RCA Service (The "Causal AI" Engine)

Domain: This service delivers the "super expert" RCA capability, moving beyond correlation to identify causality.
Function: It combines data-driven methods (Causal Bayesian Networks) with expert knowledge (the Knowledge Graph) to produce a probabilistic root cause graph for any ProductionEvent.
Core Technology Specification: This service must implement the Interactive Causal Bayesian Network (CBN) + Knowledge Graph methodology.7
Rationale: A naive, data-driven-only approach (e.g., simple correlation) fails in complex manufacturing environments, producing thousands of spurious correlations. An expert-only system (like a manual 5-Why) is slow and biased.38 The fusion of the two is state-of-the-art. The KG provides the "structural priors" (expert knowledge) that make the data-driven CBN learning feasible and accurate.8
The "Intelligent RCA" Workflow:
An RCAAnalysis is triggered (either manually by a user in the frontend 9 or automatically by a high-severity ProductionEvent).
The Intelligent RCA Service queries the Knowledge Graph Service (Part 5.1) to get the "structural prior." This includes:
The asset hierarchy (e.g., C-101 is part of Line-1).
Process flow (e.g., Asset-A IS_UPSTREAM_OF Asset-B).
Exclusion rules (e.g., Asset-A HAS_NO_IMPACT_ON Asset-C).
The service then queries the Historian Integration Service (Part 4.1) for the relevant high-resolution SensorTag data for all assets in the hierarchy, centered around the event's time window.
It feeds this time-series data and the KG-based structural prior into a CBN learning algorithm (e.g., PC-algorithm, NOTEARS).40 The prior prunes the search space of the CBN, telling the algorithm not to even bother testing for causality where it's physically impossible (e.g., a downstream event cannot cause an upstream event).8
The output is a "root cause graph" (a CBN), which is a set of CausalHypothesis nodes showing probabilistic causal links (e.g., "A deviation in Tag-101 has a 75% probability of causing the deviation in Tag-205").
This graph is persisted to the Knowledge Graph Service and visualized for the user in the frontend RCAModule.9 The user can interact with it, accept/reject hypotheses, and provide feedback (e.g., "Blacklist this spurious relationship"), which in turn updates the KG priors for the next analysis.8

5.4 Applied Graph Science: Redefining "Top 10 Bad Actors"

The current system's "Top 10 Bad Actors" chart is a simple, cost-based accounting metric.1 The new platform will leverage the Intelligent RCA Service to provide a "super expert" analysis of systemic risk.
A "true" bad actor is not just an asset that fails often, but an asset whose failure causes the most downstream failures. This is a problem of influence or centrality within the causal graph.42
The Intelligent RCA Service will therefore run graph analytics algorithms on the causal graph (the :CausalHypothesis nodes and their relationships) stored in the Knowledge Graph:
PageRank: Originally for ranking web pages, PageRank is a measure of influence.43 When applied to the causal graph, it will rank Assets or ProductionEvents based on their role as a root cause of other high-impact events. An asset that is the root cause of 10 other failures will rank higher than an asset that fails 20 times but causes no downstream impact.43
EigenCentrality: This algorithm measures a node's influence based on the influence of its neighbors.42 In this context, it will identify Assets that may not be frequent root causes themselves but are central to the propagation of failures—identifying them as critical systemic risks.
This replaces a shallow "Top 10 by Cost" list with a "Top 10 Most Influential Root Causes," providing a level of actionable, systemic insight the current system cannot.

Part 6: Foundational Services: Security & Resilience


6.1 A Defense-in-Depth Security Posture

Security in a distributed, cloud-native industrial system is non-negotiable and must be multi-layered, moving beyond simple edge-level authorization.18
Identity & Access (User): All users authenticating via the frontend 9 must be managed by an OIDC-compliant Identity Provider (e.g., Okta, Azure Active Directory). The frontend application will be responsible for handling the OAuth2/OIDC flow (e.g., redirect to a login page) and will receive a JSON Web Token (JWT) upon successful authentication.44
Edge Security (Gateway): The API Gateway (Part 2.4) must validate the signature and audience of this JWT on every incoming request.18 It then passes the validated JWT's claims (e.g., userId, role) to the downstream microservices via request headers.
Service-to-Service (Internal): All internal, synchronous communication between microservices (e.g., Gateway to Planning Service) must be secured using mutual TLS (mTLS).44 This cryptographically ensures that both the client and server are who they claim to be, preventing a compromised pod from spoofing another service's identity within the cluster.
Data Security: All data must be encrypted at rest (in all databases) and in transit (via TLS for external traffic and mTLS for internal traffic).

6.2 High-Availability & Resilience Patterns

In a distributed system, failures are not if, but when.14 The architecture must be designed to handle these failures gracefully.
Network Resilience: All synchronous (HTTP) service-to-service calls must implement standard resilience patterns, typically via a service mesh (e.g., Istio, Linkerd) or client-side libraries:
Timeouts: No request should wait indefinitely.
Retries: Automatic retries for transient network failures.
Circuit Breaker Pattern: After a configurable number of failed requests to a specific service (e.g., the Planning Service), the circuit "breaks," and all further requests to it fail immediately for a cool-down period. This prevents the calling service (e.g., the API Gateway) from wasting resources and hanging while waiting for a dead service to respond.
Asynchronous Resilience: As described in Part 2.2, Apache Kafka provides the primary resilience layer for all asynchronous workflows. If a consuming service fails, messages are retained in the topic until the service recovers. A Dead Letter Queue (DLQ) strategy will be implemented to handle "poison pill" messages (e.g., malformed data) that would cause a consumer to crash repeatedly, preventing the entire pipeline from halting.
Graceful Degradation: Services must be designed to function in a degraded state. For example, if the AI Reconciliation Service (Part 4.5) fails, the Production Data & Reconciliation Service (Part 3.2) should not fail. It should detect that an automated classification has not been received, mark the ProductionLoss as "Pending Manual Reconciliation," and allow the user to fall back to the legacy manual workflow.1 This ensures the core system remains operational even when its intelligent components are down.

Part 7: A Phased Implementation Roadmap

This comprehensive architecture represents a significant technological leap. A phased implementation is recommended to de-risk the project, deliver value incrementally, and build momentum.

Phase 1: The Foundation (Core Services & Baseline PLA)

Goal: Achieve functional parity with the manual capabilities of the current system 1 while establishing the modern microservice foundation.
Services to Build:
Master Data Service (Part 3.3)
Production Planning & Profile Service (Part 3.1)
Production Data & Reconciliation Service (Part 3.2) - Manual workflows only.
API Gateway (Part 2.4)
Security (OIDC) (Part 6.1)
Infrastructure: Kubernetes (Part 2.3) & Kafka (Part 2.2).
Outcome: A functional, manual PLA system that is scalable, secure, and resilient. The frontend 9 can be launched against this baseline.

Phase 2: The Intelligent Layer (Ingestion, CEP & AI-Assist)

Goal: Automate event creation and reconciliation, fundamentally inverting the workflow from reactive to proactive.
Services to Build:
Historian Integration Service (Part 4.1) - Configured for Aveva PI Event Frames 10.
CEP Service (Part 4.2)
"Event Logic" Rules Engine Service (Part 4.3)
AI Reconciliation Service (Part 4.5)
Modifications: Update Production Data & Reconciliation Service to consume the new automated event and classification topics from Kafka.
Outcome: The system is now proactive. SystemEvents and InferredEvents are created automatically. The manual reconciliation burden on analysts drops significantly. Engineers can now define their own event logic in real-time.

Phase 3: The Contextual Pinnacle (Knowledge Graph & Causal RCA)

Goal: Deliver the "super expert" causal analysis and predictive insights that differentiate this platform from all competitors.
Services to Build:
Knowledge Graph Service (Part 5.1) - With the full ontology (Part 5.2).
Intelligent RCA Service (Part 5.3) - With the KG+CBN engine 8.
Predictive Analytics Service (Part 4.4)
Modifications: Update all services to produce events for the Knowledge Graph Service to consume (the "graph hydration" workflow).
Outcome: The platform moves from proactive to predictive. It can detect failures before they occur (PredictedEvents), and it can identify the true causal root of complex failures, enabling a new class of systemic OEE and reliability improvements.4







Project Kickoff: The "PLA-360" Platform
To the Development Team:
The Core Mandate: We are inverting the traditional, reactive accounting-based PLA model.1 The legacy system calculates an Unaccounted Loss and forces analysts to manually find events to justify it.1 Our new system is "Event-First."
Events Occur: A production event is captured (from PI 2, generated by user-defined logic 1, or predicted by AI 4).
Loss is Quantified: The system immediately creates a ProductionLoss record caused by that event.
Context is Applied: The system uses its Knowledge Graph and AI models to automatically classify the loss and identify its true root cause.
This document provides the full development specification, broken down into service-level prompts. Let's begin.

Part 1: Foundational Setup (Infrastructure & Core Tech)
Before writing any business logic, we must build the "factory floor" for our microservices.
Prompt 1.1: Initialize Kubernetes (K8s) Cluster
Task: Provision a production-grade Kubernetes cluster (e.g., GKE, EKS, or AKS).5
Action: Configure kubectl contexts and establish namespaces for platform-core, platform-ingestion, platform-intelligence, and platform-foundation.
Prompt 1.2: Deploy Event-Driven Backbone (Apache Kafka)
Task: Deploy a highly available Apache Kafka cluster within K8s (or use a managed service).6
Action: Create the following initial set of topics. These are the "digital nervous system" of our platform:
platform.masterdata.products.updated
platform.masterdata.codes.updated
platform.masterdata.assets.updated
platform.planning.plans.created
platform.planning.profiles.updated
industrial.historian.pi.eventframes.created
industrial.historian.tags.streaming
platform.rules.definitions.updated
industrial.cep.events.inferred
platform.ai.events.predicted
platform.production.losses.created_unreconciled
platform.ai.reconciliation.classified
platform.rca.analysis.completed
Prompt 1.3: Configure API Gateway & Edge Security
Task: Deploy an API Gateway (e.g., NGINX Ingress 7, Kong) as the single entry point for all external traffic.
Action:
Implement the API Gateway pattern. All frontend requests 8 must route through this gateway.
Configure the Gateway as the primary security enforcement point. It must terminate TLS (HTTPS) and be responsible for validating OIDC/OAuth2 JWT tokens on every incoming request.9
Implement basic routing rules to map public API paths (e.g., /api/v1/plans/*) to the internal K8s service names (e.g., production-planning-service.platform-core.svc.cluster.local).

Part 2: Core Domain & Master Data Services
These services are the system of record for our core business entities.1
Prompt 2.1: Build Master Data Service
Task: Create a new microservice (master-data-service) responsible for all administrative and foundational data. This service is the "source of truth" for the entities it owns.1
Database Schema (PostgreSQL): Define tables for the following entities:
Products: product_id (PK), name, description, status ('Active', 'Inactive').1
Codes: code_id (PK), code_value, description, code_type ('OEE', 'Impact', 'Event'), parent_code_id (FK, for hierarchy).1
ProductionUnits (Asset Hierarchy): unit_id (PK), name, description, timezone, parent_unit_id (FK, for hierarchy).1
API Specification (REST): Implement the following endpoints. These will be consumed by the frontend AdminPanel.8
GET /api/v1/admin/products
POST /api/v1/admin/products
PUT /api/v1/admin/products/{id}
GET /api/v1/admin/codes?type={type}
POST /api/v1/admin/codes
PUT /api/v1/admin/codes/{id}
GET /api/v1/admin/units (Return as a tree)
POST /api/v1/admin/units
PUT /api/v1/admin/units/{id}
Event Logic (Producer): On any CUD operation (Create, Update, Delete) for an entity, produce a message to the corresponding Kafka topic (e.g., a change to Products publishes to platform.masterdata.products.updated). This ensures eventual consistency across the platform.
Prompt 2.2: Build Production Planning & Profile Service
Task: Create a new microservice (production-planning-service) responsible for what an asset can produce (Profiles) and what it should produce (Plans).1
Database Schema (PostgreSQL):
ProductionProfiles: profile_id (PK), unit_id (FK), product_id (FK), max_sustained_capacity_rate (float), planning_rate (float), product_uom (string), rate_uom (string).1
PlanTemplates: template_id (PK), name, unit_id (FK), config_json (JSONB containing products, shifts, etc.).1
ProductionPlans: plan_id (PK), unit_id (FK), plan_basis ('Time', 'Quantity', 'Manual'), status ('Planning', 'Approved', 'Complete'), start_time, end_time.1
PlanPeriods: plan_period_id (PK), plan_id (FK), product_id (FK), start_time, end_time, planned_quantity, short_range_plan_quantity.1
API Specification (REST):
POST /api/v1/plans/build (Implements the "Production Plan Builder" logic 1)
POST /api/v1/plans/template (Uses a PlanTemplate 1)
POST /api/v1/plans/manual 1
GET /api/v1/plans: List all plans.
GET /api/v1/plans/{id}: Get full plan details, including its PlanPeriods.1
GET /api/v1/plans/{id}/summary: Get the production summary view.1
POST /api/v1/plans/{id}/approve: Approve a plan.1
GET /api/v1/admin/profiles: CRUD for ProductionProfiles.1
GET /api/v1/admin/templates: CRUD for PlanTemplates.1
Event Logic (Producer/Consumer):
Producer: Publish messages to platform.planning.plans.created and platform.planning.profiles.updated on CUD operations.
Consumer: Subscribe to platform.masterdata.assets.updated and platform.masterdata.products.updated to maintain data consistency (e.g., in local caches or for validation).

Part 3: The "Event-First" PLA Core
This service is the heart of the PLA module, managing actual production data and executing the new, event-first loss reconciliation workflow.
Prompt 3.1: Build Production Data & Reconciliation Service
Task: Create a new microservice (production-data-service) that owns ProductionData and ProductionLoss entities.1
Database Schema (PostgreSQL or TimescaleDB):
ProductionData: data_id (PK), plan_period_id (FK), product_id (FK), period_start, period_end, actual_quantity (float), unaccounted_loss (float, calculated).1
ProductionLosses: loss_id (PK), data_id (FK), loss_amount (float), cost (float), reconciliation_status ('Unreconciled', 'Reconciled'), event_code_id (FK), oee_code_id (FK), impact_code_id (FK), production_event_id (string, external ref), comment (text).1
API Specification (REST) - Manual Workflows:
GET /api/v1/plans/{planId}/production-data: Get all ProductionData records for a plan.1
PUT /api/v1/production-data/{dataId}: Manually update actual_quantity or short_range_plan_quantity.1
GET /api/v1/production-data/{dataId}/losses: Get all ProductionLoss records for a data period.1
POST /api/v1/production-data/{dataId}/losses: (Manual Workflow) Manually create a ProductionLoss to reconcile a legacy Unaccounted Loss.1
POST /api/v1/losses/{lossId}/link-event: (Manual Workflow) Manually link an event to a loss.1
PUT /api/v1/losses/{lossId}: (Manual Workflow) Manually edit a ProductionLoss (e.g., assign codes).1
Event Logic (Consumer) - Automated "Event-First" Workflow:
1. Consume industrial.historian.pi.eventframes.created, industrial.cep.events.inferred, platform.ai.events.predicted:
Action: When an event is received, automatically create a new ProductionLoss record.
Logic:
Link it to the ProductionData record for the corresponding time period.
Set production_event_id to the ID from the event message.
Calculate loss_amount based on the event's duration and the asset's ProductionProfile (from the Planning Service).
Set reconciliation_status to 'Unreconciled'.
Publish this new loss to platform.production.losses.created_unreconciled.
2. Consume platform.ai.reconciliation.classified:
Action: When an AI-classified loss is received, update the corresponding ProductionLoss record.
Logic:
Find ProductionLoss by loss_id.
Set event_code_id, oee_code_id, and impact_code_id based on the message payload.
Set reconciliation_status to 'Reconciled'.

Part 4: Real-Time Ingestion & Event Generation
This domain is responsible for connecting to industrial systems and generating the events that drive our platform.
Prompt 4.1: Build Historian Integration Service
Task: Create a gateway service (historian-integration-service) to abstract all OT data systems. It is the only service that talks to PI/OPC.
API Specification (Ingestion):
POST /api/v1/ingest/aveva/eventframe: Implement a secure webhook endpoint. This is the target for Aveva PI Notifications to push SystemEvent data to our platform.11
Event Logic (Producer):
1. PI Event Frame Ingestion: On receiving a POST to /api/v1/ingest/aveva/eventframe, validate the data and immediately produce it as a new message on the industrial.historian.pi.eventframes.created topic.2
2. Time-Series Ingestion: Implement connectors (e.g., using PI SDK, OPC UA clients) to subscribe to raw SensorTag data streams.
Action: Produce this high-velocity data onto the industrial.historian.tags.streaming topic. The message schema should be: { "tag": "string", "timestamp": "isodate", "value": "any" }.
Prompt 4.2: Build "Event Logic" Rules Engine Service
Task: Create a service (rules-engine-service) that provides a UI/API for engineers to create and manage event-triggering logic without code.13
Database Schema (PostgreSQL):
EventRules: rule_id (PK), name (string), description (text), target_asset_id (string), severity (string), rule_definition (JSONB).
The rule_definition JSONB should store the logic, e.g., { "trigger": "ANY", "conditions": }.
API Specification (REST):
GET /api/v1/admin/rules: List all rules.
POST /api/v1/admin/rules: Create a new EventRule.
PUT /api/v1/admin/rules/{id}: Update an EventRule.
DELETE /api/v1/admin/rules/{id}: Delete an EventRule.
Event Logic (Producer):
"Hot-Deploy" Mechanism: On any POST, PUT, or DELETE request via the API, this service must publish the entire updated rule definition to the platform.rules.definitions.updated topic. This allows the CEP Service to update its logic in real-time.
Prompt 4.3: Build Complex Event Processing (CEP) Service
Task: Create the real-time pattern matching engine (cep-service) that generates InferredEvents.14
Technology Stack: Use Apache Flink. This is a hard requirement. Do not use Spark Streaming, as we need Flink's true stream-processing, low-latency, and superior stateful CEP capabilities.19
Application Logic (Apache Flink Job):
1. Consume industrial.historian.tags.streaming: This is the primary data source.
2. Consume platform.rules.definitions.updated (as a Broadcast Stream): Use this stream to dynamically update the set of active rules within the Flink job without restarting it. This implements the "hot-deploy".13
3. Apply CEP Logic: Use Flink's CEP library to apply all active EventRule definitions against the tag data stream.
4. Produce InferredEvent: When a rule pattern is matched (e.g., "Tag-101 > 90 for 5 minutes"), create and produce a new event message to the industrial.cep.events.inferred topic. The message must include the rule that triggered it, the asset, start/end times, and the tag values involved.

Part 5: The Intelligence Layer (AI/ML Services)
This domain hosts the AI models that move our platform from automated to intelligent.
Prompt 5.1: Build Predictive Analytics Service
Task: Create a model-hosting service (predictive-analytics-service) for predictive maintenance and anomaly detection.
Models to Implement: Host the following models trained on historical sensor data:
LSTM Autoencoder: For multivariate anomaly detection on complex assets.23
Isolation Forest: For faster, high-dimensional anomaly detection.23
One-Class SVM: For robust "normalcy" boundary detection.23
Application Logic:
Consume industrial.historian.tags.streaming: Feed the real-time tag data to the deployed models for inference.
Produce PredictedEvent: When a model flags a statistically significant anomaly (a deviation from "normal" operation), produce a message to platform.ai.events.predicted. This message represents a failure before it happens.4
Prompt 5.2: Build AI Reconciliation Service
Task: Create a service (ai-reconciliation-service) to automate the manual, time-consuming task of classifying losses.29
Models to Implement:
1. NLP Model: Train a BERT-based classifier or similar NLP model 32 to parse operator logs/comments (from the ProductionLoss.comment field) and assign EventCode, OEECode, and ImpactCode.
2. ML Classification Model: Train an ensemble model (e.g., Random Forest, XGBoost 37) on historical sensor/alarm data to classify events without operator comments. The features are the alarm patterns and tag values leading up to the event; the labels are the codes assigned by experts in the past.37
Application Logic:
Consume platform.production.losses.created_unreconciled:
Action: When a new unreconciled loss arrives, retrieve its full context (event data, comments).
Logic:
If comment exists, use the NLP Model.
If not, use the ML Classification Model.
Produce platform.ai.reconciliation.classified: Publish a message with the loss_id and the event_code_id, oee_code_id, and impact_code_id suggested by the AI, along with a confidence score.

Part 6: The Context Layer (Knowledge Graph & Causal RCA)
This is our "super expert" layer. It connects all data and discovers true causality.
Prompt 6.1: Build Knowledge Graph Service
Task: Create the central context engine (knowledge-graph-service) that understands the relationships between all entities.
Technology Stack: Use Neo4j (or another native property graph database).42
Ontology (Property Graph Model): Define the following graph schema 47:
Node Label
Properties
Relationship (Edge)
Target Node
Asset
name, type
HAS_CHILD_ASSET
Asset
Asset
assetId
IS_UPSTREAM_OF
Asset
Asset
assetId
HAS_TAG
SensorTag
SensorTag
tagId, uom
MEASURES
Asset
Product
productCode
PRODUCED_BY
Asset
ProductionPlan
planId, status
SCHEDULED_ON
Asset
ProductionEvent
eventId, type
OCCURRED_AT
Asset
ProductionEvent
startTime, endTime
AFFECTED
Product
ProductionEvent
description
CAUSED
ProductionLoss
ProductionLoss
lossAmount, cost
CLASSIFIED_BY
Code
Code
codeId, type
IS_CHILD_OF
Code
RCAAnalysis
analysisId, status
INVESTIGATES
ProductionEvent
CausalHypothesis
probability
IS_ROOT_CAUSE_OF
ProductionEvent


Application Logic (Graph Hydration):
Implement a "Super-Consumer": This service must subscribe to all major business event topics (e.g., platform.masterdata.assets.updated, industrial.cep.events.inferred, platform.planning.plans.created, platform.rca.analysis.completed).
Action: As messages arrive, execute Cypher queries to create or update nodes and relationships in Neo4j, ensuring the graph is a near-real-time reflection of the entire application state.
Prompt 6.2: Build Intelligent RCA Service
Task: Create the intelligent-rca-service to perform "super expert" root cause analysis, moving beyond simple correlation.55
API Specification (REST):
POST /api/v1/rca/start/{eventId}: Triggers a new RCA investigation.
GET /api/v1/rca/{analysisId}: Returns the status and results (a causal graph) of an analysis.
POST /api/v1/rca/feedback: Allows an expert user to provide feedback (e.g., "This causal link is wrong").59
Application Logic (CBN + KG Methodology):
1. On RCA Trigger:
Query the Knowledge Graph Service to get structural priors (e.g., IS_UPSTREAM_OF relationships, asset hierarchy).
2. Fetch Data:
Query the Historian Integration Service for high-resolution SensorTag data for all related assets around the event's time window.
3. Learn Causal Graph:
Feed both the structural priors (from KG) and the time-series data into a Causal Bayesian Network (CBN) learning algorithm (e.g., PC-algorithm).65 The priors are used to prune the search space, making the analysis faster and more accurate.
4. Persist Results:
Save the learned probabilistic links as :CausalHypothesis nodes in the Knowledge Graph.
5. Implement Graph Analytics (for "Bad Actor" Analysis):
Implement the PageRank and EigenCentrality algorithms.68
Run these algorithms not on the asset hierarchy, but on the causal graph (the :CausalHypothesis relationships) to identify the assets that are the most influential root causes of other failures. This provides our "Top 10 Bad Actors" based on systemic influence, not just simple cost.

Part 7: Frontend Application (Unified-APM Portal)
This is the user-facing control center. Your primary specification is the FRONTEND_FULL_DOCUMENTATION 1.md file.8
Prompt 7.1: Initialize Frontend Application
Task: Initialize a new React/Vite application.8
Action: Set up the project structure, theme provider (e.g., MUI), and routing (e.g., React Router).
Prompt 7.2: Implement Core Authentication
Task: Build the AuthContext provider as specified in the frontend doc.8
Action:
Implement the OIDC/OAuth2 login flow.
All API calls must acquire the JWT from this context and pass it to the API Gateway in the Authorization header.
Implement logic to fetch user permissions and organization metadata after login.8
Prompt 7.3: Build Application Modules (per Frontend Doc 8)
Task: Build the following React modules, connecting them to the backend microservice APIs defined above.
Action:
AdminPanel / MasterData Module 8:
Build UI for managing Products, Codes, and the Asset Hierarchy (Production Units).1
Connect all CUD operations to the Master Data Service APIs (e.g., GET /api/v1/admin/products).
ProductionPlans Module 8:
Build the UI for the Plan Builder, Plan Templates, and Plan Dashboard.1
Connect to the Production Planning & Profile Service APIs (e.g., POST /api/v1/plans/build).
PLADashboard / EventHub Module 8:
Build the core PLA interface for viewing ProductionData and reconciling ProductionLosses.
Connect to the Production Data & Reconciliation Service APIs (e.g., GET /api/v1/plans/{planId}/production-data).
Ensure this UI supports both the legacy manual workflow (creating a loss to match a number) and the new "Event-First" workflow (viewing losses that were already created by events).
Connectivity / EnhancedHistorian Module 8:
Build the UI for managing historian connections.8
Build the UI for the "Event Logic" Rules Engine.8
Connect this UI to the Rules Engine Service APIs (e.g., POST /api/v1/admin/rules).
RCAModule 8:
Build the UI for initiating and reviewing Root Cause Analyses.1
Connect to the Intelligent RCA Service APIs (e.g., POST /api/v1/rca/start/{eventId}).
Implement a graph visualization component (e.g., using react-flow or vis.js) to render the causal graph JSON returned from the Knowledge Graph Service.
DataSeedingPage 8:
Build the debug/admin page for seeding data as described in the frontend doc.8

Product Management Directive: Phased Rollout
Execute this plan in the order specified.
Phase 1 (Foundation): Complete Parts 1, 2, and 3. This gives us a modern, microservice-based version of the legacy manual PLA system.
Phase 2 (Automation): Complete Part 4. This introduces automated event generation and inverts the workflow to "Event-First."
Phase 3 (Intelligence): Complete Parts 5 and 6. This delivers the "AI-by-design" and "super expert" RCA capabilities.
This plan is ambitious and will redefine the market. Let's get to work.


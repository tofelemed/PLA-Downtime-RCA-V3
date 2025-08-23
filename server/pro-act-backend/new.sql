-- ProAct Database Schema (SQL Server)
-- Generated from API_REFERENCE.md

-- USERS
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    passwordHash NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) NOT NULL CHECK (role IN ('SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Analyst', 'Engineer', 'Operator')),
    isActive BIT NOT NULL DEFAULT 1,
    tenantId UNIQUEIDENTIFIER NULL,
    organizationId UNIQUEIDENTIFIER NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- ORGANIZATIONS
CREATE TABLE organizations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(1000) NULL,
    isActive BIT NOT NULL DEFAULT 1,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    tenantId UNIQUEIDENTIFIER NULL
);

-- TENANTS
CREATE TABLE tenants (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(1000) NULL,
    organizationId UNIQUEIDENTIFIER NOT NULL,
    isActive BIT NOT NULL DEFAULT 1,
    address NVARCHAR(255) NULL,
    contactPerson NVARCHAR(255) NULL,
    contactEmail NVARCHAR(255) NULL,
    contactPhone NVARCHAR(50) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- UNITS
CREATE TABLE units (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(1000) NULL,
    capacity INT NOT NULL,
    unitOfMeasure NVARCHAR(50) NOT NULL,
    idealCycleTime FLOAT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- ASSETS
CREATE TABLE assets (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(100) NOT NULL UNIQUE,
    unitId UNIQUEIDENTIFIER NOT NULL,
    description NVARCHAR(1000) NULL,
    assetType NVARCHAR(50) NOT NULL,
    criticality NVARCHAR(50) NOT NULL,
    manufacturer NVARCHAR(255) NULL,
    model NVARCHAR(255) NULL,
    serialNumber NVARCHAR(255) NULL,
    installationDate DATETIME2 NULL,
    lastMaintenanceDate DATETIME2 NULL,
    nextMaintenanceDate DATETIME2 NULL,
    status NVARCHAR(50) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    userId UNIQUEIDENTIFIER NOT NULL,
    userName NVARCHAR(255) NOT NULL,
    action NVARCHAR(255) NOT NULL,
    entityType NVARCHAR(255) NOT NULL,
    entityId UNIQUEIDENTIFIER NOT NULL,
    details NVARCHAR(MAX) NOT NULL,
    organizationId UNIQUEIDENTIFIER NULL,
    tenantId UNIQUEIDENTIFIER NULL,
    ipAddress NVARCHAR(50) NULL,
    userAgent NVARCHAR(255) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    timestamp DATETIME2 NULL
);

-- IMPACT CODES
CREATE TABLE impact_codes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL UNIQUE,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    category NVARCHAR(50) NOT NULL CHECK (category IN ('Quality', 'Availability', 'Performance')),
    costPerUnit FLOAT NULL,
    costPerHour FLOAT NULL,
    costBasis NVARCHAR(50) NULL CHECK (costBasis IN ('perUnit', 'perHour')),
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- OEE CODES
CREATE TABLE oee_codes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL UNIQUE,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    category NVARCHAR(50) NOT NULL CHECK (category IN ('Planned', 'Unplanned')),
    impactType NVARCHAR(50) NOT NULL CHECK (impactType IN ('Availability', 'Performance', 'Quality')),
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- RCA CAUSE CODES
CREATE TABLE rca_cause_codes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL UNIQUE,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    category NVARCHAR(50) NOT NULL CHECK (category IN ('Equipment', 'Process', 'Material', 'Personnel', 'Environment', 'Method')),
    parentId UNIQUEIDENTIFIER NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- VERIFICATION STATUS CODES
CREATE TABLE verification_status_codes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL UNIQUE,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    color NVARCHAR(50) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    items NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- PRODUCTS
CREATE TABLE products (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(100) NOT NULL UNIQUE,
    unitOfMeasure NVARCHAR(50) NOT NULL,
    description NVARCHAR(1000) NULL,
    standardCost FLOAT NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- PRODUCTION PLANS
CREATE TABLE production_plans (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    unitId UNIQUEIDENTIFIER NOT NULL,
    productId UNIQUEIDENTIFIER NOT NULL,
    plannedQuantity FLOAT NOT NULL,
    toleranceLimit FLOAT NOT NULL,
    startDate DATETIME2 NOT NULL,
    endDate DATETIME2 NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    planBasis NVARCHAR(255) NULL,
    usefulProductionTime NVARCHAR(MAX) NULL,
    recurrence NVARCHAR(255) NULL,
    dataEntryFrequency NVARCHAR(255) NULL,
    status NVARCHAR(50) NOT NULL CHECK (status IN ('Planned', 'Active', 'Completed', 'Cancelled')),
    actualQuantity FLOAT NULL,
    shift NVARCHAR(255) NULL,
    crew NVARCHAR(255) NULL,
    plannerNotes NVARCHAR(MAX) NULL,
    comments NVARCHAR(MAX) NULL,
    approvalStatus NVARCHAR(50) NOT NULL CHECK (approvalStatus IN ('Draft', 'Pending Review', 'Pending Approval', 'Approved', 'Rejected')),
    submittedBy NVARCHAR(255) NULL,
    submittedAt DATETIME2 NULL,
    reviewedBy NVARCHAR(255) NULL,
    reviewedAt DATETIME2 NULL,
    approvedBy NVARCHAR(255) NULL,
    approvedAt DATETIME2 NULL,
    rejectionReason NVARCHAR(MAX) NULL,
    customAttributes NVARCHAR(MAX) NULL,
    auditTrail NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- PRODUCTION PLAN TEMPLATES
CREATE TABLE production_plan_templates (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    unitId UNIQUEIDENTIFIER NOT NULL,
    productIds NVARCHAR(MAX) NOT NULL,
    planBasis NVARCHAR(255) NOT NULL,
    startDate DATETIME2 NOT NULL,
    endDate DATETIME2 NOT NULL,
    recurrence NVARCHAR(255) NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    orgId UNIQUEIDENTIFIER NULL,
    version INT NULL,
    usefulProductionTime NVARCHAR(MAX) NULL,
    dataEntryFrequency NVARCHAR(255) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- PRODUCTION EVENTS
CREATE TABLE production_events (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    eventId NVARCHAR(255) NOT NULL,
    planId UNIQUEIDENTIFIER NULL,
    unitId UNIQUEIDENTIFIER NOT NULL,
    assetId UNIQUEIDENTIFIER NULL,
    impactCodeId UNIQUEIDENTIFIER NULL,
    oeeCodeId UNIQUEIDENTIFIER NULL,
    description NVARCHAR(MAX) NOT NULL,
    startTime DATETIME2 NOT NULL,
    endTime DATETIME2 NULL,
    source NVARCHAR(50) NOT NULL CHECK (source IN ('Manual', 'Simulated PI', 'CMMS')),
    quantity FLOAT NULL,
    cost FLOAT NULL,
    status NVARCHAR(50) NOT NULL CHECK (status IN ('Open', 'Coded', 'RCA Required', 'Closed', 'Investigating', 'In Progress', 'Completed', 'Cancelled')),
    rcaId UNIQUEIDENTIFIER NULL,
    eventType NVARCHAR(50) NOT NULL CHECK (eventType IN ('ProductionLoss', 'IOW', 'SOL', 'APM', 'FailureWO', 'ProductionOutput')),
    parameter NVARCHAR(255) NULL,
    value FLOAT NULL,
    limit FLOAT NULL,
    limitType NVARCHAR(50) NULL CHECK (limitType IN ('High', 'Low')),
    breachDuration FLOAT NULL,
    solType NVARCHAR(50) NULL CHECK (solType IN ('Safety', 'Operational')),
    apmType NVARCHAR(255) NULL,
    severity NVARCHAR(50) NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    recommendedAction NVARCHAR(MAX) NULL,
    workOrderId NVARCHAR(255) NULL,
    failureMode NVARCHAR(255) NULL,
    defectiveQuantity FLOAT NULL,
    shift NVARCHAR(255) NULL,
    crew NVARCHAR(255) NULL,
    auditTrail NVARCHAR(MAX) NULL,
    lossCategory NVARCHAR(255) NULL,
    operatorName NVARCHAR(255) NULL,
    reasonCodeId UNIQUEIDENTIFIER NULL,
    duration FLOAT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- RCAS
CREATE TABLE rcas (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    eventId UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(50) NOT NULL CHECK (status IN ('Draft', 'In Progress', 'Analysis', 'Published', 'Closed')),
    teamLeadId UNIQUEIDENTIFIER NOT NULL,
    teamMemberIds NVARCHAR(MAX) NOT NULL,
    priority NVARCHAR(50) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    targetCloseDate DATETIME2 NULL,
    actualCloseDate DATETIME2 NULL,
    rootCause NVARCHAR(MAX) NULL,
    recommendations NVARCHAR(MAX) NOT NULL,
    logicTree NVARCHAR(MAX) NULL,
    evidence NVARCHAR(MAX) NOT NULL,
    templateId UNIQUEIDENTIFIER NULL,
    teamCharter NVARCHAR(MAX) NULL,
    eventDiagram NVARCHAR(MAX) NULL,
    preFailureRate FLOAT NULL,
    postFailureRate FLOAT NULL,
    failureCostPerIncident FLOAT NULL,
    implementationCost FLOAT NULL,
    timeToResolution FLOAT NULL,
    timeToImplementation FLOAT NULL,
    effectivenessScore FLOAT NULL,
    lastUpdated DATETIME2 NULL,
    trackingNotes NVARCHAR(MAX) NULL,
    phaseTimeline NVARCHAR(MAX) NULL,
    calculatedROI FLOAT NULL,
    costSavings FLOAT NULL,
    downtimeReduction FLOAT NULL,
    productivityImprovement FLOAT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- RCA RECOMMENDATIONS
CREATE TABLE rca_recommendations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    rcaId UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    priority NVARCHAR(50) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
    assigneeId UNIQUEIDENTIFIER NOT NULL,
    dueDate DATETIME2 NULL,
    status NVARCHAR(50) NOT NULL CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
    cmmsWorkOrderId NVARCHAR(255) NULL,
    estimatedCost FLOAT NULL,
    actualCost FLOAT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- RCA EVIDENCE
CREATE TABLE rca_evidence (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    rcaId UNIQUEIDENTIFIER NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    type NVARCHAR(50) NOT NULL CHECK (type IN ('Photo', 'Document', 'Time Series', 'Note', 'Video')),
    fileName NVARCHAR(255) NULL,
    filePath NVARCHAR(255) NULL,
    collectedBy NVARCHAR(255) NOT NULL,
    collectedAt DATETIME2 NOT NULL,
    nodeIds NVARCHAR(MAX) NULL,
    fileBlob VARBINARY(MAX) NULL,
    category NVARCHAR(255) NULL,
    location NVARCHAR(255) NULL,
    timestamp DATETIME2 NULL,
    relatedAssetId UNIQUEIDENTIFIER NULL,
    severity NVARCHAR(50) NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    tags NVARCHAR(MAX) NULL,
    verified BIT NULL,
    fiveP NVARCHAR(50) NULL CHECK (fiveP IN ('Parts', 'Paper', 'People', 'Place', 'Process')),
    task NVARCHAR(255) NULL,
    dueDate DATETIME2 NULL,
    status NVARCHAR(50) NULL CHECK (status IN ('pending', 'completed')),
    attachments NVARCHAR(MAX) NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- LOGIC TREE NODES
CREATE TABLE logic_tree_nodes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    rcaId UNIQUEIDENTIFIER NOT NULL,
    parentId UNIQUEIDENTIFIER NULL,
    question NVARCHAR(MAX) NOT NULL,
    answer NVARCHAR(MAX) NULL,
    type NVARCHAR(50) NOT NULL CHECK (type IN ('Root', 'Why', 'How', 'Cause')),
    verified BIT NOT NULL,
    evidenceIds NVARCHAR(MAX) NOT NULL,
    position NVARCHAR(MAX) NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- TASKS
CREATE TABLE tasks (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    assignedTo UNIQUEIDENTIFIER NOT NULL,
    assignedBy UNIQUEIDENTIFIER NOT NULL,
    priority NVARCHAR(50) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status NVARCHAR(50) NOT NULL CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
    dueDate DATETIME2 NULL,
    completedDate DATETIME2 NULL,
    entityType NVARCHAR(255) NULL,
    entityId UNIQUEIDENTIFIER NULL,
    organizationId UNIQUEIDENTIFIER NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- RCA TEMPLATES
CREATE TABLE rca_templates (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    category NVARCHAR(255) NOT NULL,
    logicTreeStructure NVARCHAR(MAX) NOT NULL,
    verificationChecklist NVARCHAR(MAX) NOT NULL,
    organizationId UNIQUEIDENTIFIER NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- EVIDENCE CATEGORIES
CREATE TABLE evidence_categories (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- EVIDENCE LOCATIONS
CREATE TABLE evidence_locations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- PRODUCTION LOSSES
CREATE TABLE production_losses (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    planId UNIQUEIDENTIFIER NOT NULL,
    period NVARCHAR(255) NOT NULL,
    actual FLOAT NOT NULL,
    shortRangePlan FLOAT NOT NULL,
    losses FLOAT NOT NULL,
    unaccountedLoss FLOAT NOT NULL,
    action NVARCHAR(50) NOT NULL CHECK (action IN ('Reconcile', 'RCA Required', 'Closed')),
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- OEE SUMMARIES
CREATE TABLE oee_summaries (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    planId UNIQUEIDENTIFIER NOT NULL,
    availability FLOAT NOT NULL,
    performance FLOAT NOT NULL,
    quality FLOAT NOT NULL,
    overallOEE FLOAT NOT NULL,
    period NVARCHAR(255) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- LOSS CATEGORIES
CREATE TABLE loss_categories (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    reconcileFormId UNIQUEIDENTIFIER NOT NULL,
    categoryName NVARCHAR(255) NOT NULL,
    lossAmount FLOAT NOT NULL,
    impactCodeId UNIQUEIDENTIFIER NOT NULL,
    oeeCodeId UNIQUEIDENTIFIER NOT NULL,
    description NVARCHAR(1000) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- RECONCILE FORMS
CREATE TABLE reconcile_forms (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    lossId UNIQUEIDENTIFIER NOT NULL,
    totalLossAmount FLOAT NOT NULL,
    categorizedLossAmount FLOAT NOT NULL,
    unaccountedLossAmount FLOAT NOT NULL,
    productionEvent NVARCHAR(255) NOT NULL,
    comment NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(50) NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected')),
    categories NVARCHAR(MAX) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- UNMAPPED EVENTS
CREATE TABLE unmapped_events (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    tenantId UNIQUEIDENTIFIER NOT NULL,
    unitId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- REASON CODES
CREATE TABLE reason_codes (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL UNIQUE,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    parentId UNIQUEIDENTIFIER NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- DASHBOARD CONFIGURATIONS
CREATE TABLE dashboard_configurations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    oee NVARCHAR(MAX) NOT NULL,
    losses NVARCHAR(MAX) NOT NULL,
    costs NVARCHAR(MAX) NOT NULL,
    bottleneckRisk NVARCHAR(MAX) NOT NULL,
    display NVARCHAR(MAX) NOT NULL,
    performance NVARCHAR(MAX) NOT NULL,
    quality NVARCHAR(MAX) NOT NULL,
    availability NVARCHAR(MAX) NOT NULL,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    isActive BIT NOT NULL DEFAULT 1,
    version INT NOT NULL,
    lastModifiedBy NVARCHAR(255) NULL,
    lastModifiedAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- APP SETTINGS
CREATE TABLE app_settings (
    [key] NVARCHAR(255) PRIMARY KEY,
    value NVARCHAR(MAX) NOT NULL
);

-- FOREIGN KEYS (add after all tables are created)
ALTER TABLE users ADD CONSTRAINT FK_users_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE users ADD CONSTRAINT FK_users_organization FOREIGN KEY (organizationId) REFERENCES organizations(id);
ALTER TABLE organizations ADD CONSTRAINT FK_organizations_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE tenants ADD CONSTRAINT FK_tenants_organization FOREIGN KEY (organizationId) REFERENCES organizations(id);
ALTER TABLE units ADD CONSTRAINT FK_units_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE assets ADD CONSTRAINT FK_assets_unit FOREIGN KEY (unitId) REFERENCES units(id);
ALTER TABLE assets ADD CONSTRAINT FK_assets_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE audit_logs ADD CONSTRAINT FK_audit_logs_user FOREIGN KEY (userId) REFERENCES users(id);
ALTER TABLE audit_logs ADD CONSTRAINT FK_audit_logs_organization FOREIGN KEY (organizationId) REFERENCES organizations(id);
ALTER TABLE audit_logs ADD CONSTRAINT FK_audit_logs_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE impact_codes ADD CONSTRAINT FK_impact_codes_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE oee_codes ADD CONSTRAINT FK_oee_codes_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE rca_cause_codes ADD CONSTRAINT FK_rca_cause_codes_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE rca_cause_codes ADD CONSTRAINT FK_rca_cause_codes_parent FOREIGN KEY (parentId) REFERENCES rca_cause_codes(id);
ALTER TABLE verification_status_codes ADD CONSTRAINT FK_verification_status_codes_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE production_plans ADD CONSTRAINT FK_production_plans_unit FOREIGN KEY (unitId) REFERENCES units(id);
ALTER TABLE production_plans ADD CONSTRAINT FK_production_plans_product FOREIGN KEY (productId) REFERENCES products(id);
ALTER TABLE production_plans ADD CONSTRAINT FK_production_plans_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE production_plan_templates ADD CONSTRAINT FK_production_plan_templates_unit FOREIGN KEY (unitId) REFERENCES units(id);
ALTER TABLE production_plan_templates ADD CONSTRAINT FK_production_plan_templates_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE production_plan_templates ADD CONSTRAINT FK_production_plan_templates_org FOREIGN KEY (orgId) REFERENCES organizations(id);
ALTER TABLE production_events ADD CONSTRAINT FK_production_events_plan FOREIGN KEY (planId) REFERENCES production_plans(id);
ALTER TABLE production_events ADD CONSTRAINT FK_production_events_unit FOREIGN KEY (unitId) REFERENCES units(id);
ALTER TABLE production_events ADD CONSTRAINT FK_production_events_asset FOREIGN KEY (assetId) REFERENCES assets(id);
ALTER TABLE production_events ADD CONSTRAINT FK_production_events_impact_code FOREIGN KEY (impactCodeId) REFERENCES impact_codes(id);
ALTER TABLE production_events ADD CONSTRAINT FK_production_events_oee_code FOREIGN KEY (oeeCodeId) REFERENCES oee_codes(id);
ALTER TABLE production_events ADD CONSTRAINT FK_production_events_rca FOREIGN KEY (rcaId) REFERENCES rcas(id);
ALTER TABLE production_events ADD CONSTRAINT FK_production_events_reason_code FOREIGN KEY (reasonCodeId) REFERENCES reason_codes(id);
ALTER TABLE rcas ADD CONSTRAINT FK_rcas_event FOREIGN KEY (eventId) REFERENCES production_events(id);
ALTER TABLE rcas ADD CONSTRAINT FK_rcas_team_lead FOREIGN KEY (teamLeadId) REFERENCES users(id);
ALTER TABLE rcas ADD CONSTRAINT FK_rcas_template FOREIGN KEY (templateId) REFERENCES rca_templates(id);
ALTER TABLE rca_recommendations ADD CONSTRAINT FK_rca_recommendations_rca FOREIGN KEY (rcaId) REFERENCES rcas(id);
ALTER TABLE rca_recommendations ADD CONSTRAINT FK_rca_recommendations_assignee FOREIGN KEY (assigneeId) REFERENCES users(id);
ALTER TABLE rca_evidence ADD CONSTRAINT FK_rca_evidence_rca FOREIGN KEY (rcaId) REFERENCES rcas(id);
ALTER TABLE rca_evidence ADD CONSTRAINT FK_rca_evidence_related_asset FOREIGN KEY (relatedAssetId) REFERENCES assets(id);
ALTER TABLE logic_tree_nodes ADD CONSTRAINT FK_logic_tree_nodes_rca FOREIGN KEY (rcaId) REFERENCES rcas(id);
ALTER TABLE logic_tree_nodes ADD CONSTRAINT FK_logic_tree_nodes_parent FOREIGN KEY (parentId) REFERENCES logic_tree_nodes(id);
ALTER TABLE tasks ADD CONSTRAINT FK_tasks_assigned_to FOREIGN KEY (assignedTo) REFERENCES users(id);
ALTER TABLE tasks ADD CONSTRAINT FK_tasks_assigned_by FOREIGN KEY (assignedBy) REFERENCES users(id);
ALTER TABLE tasks ADD CONSTRAINT FK_tasks_organization FOREIGN KEY (organizationId) REFERENCES organizations(id);
ALTER TABLE tasks ADD CONSTRAINT FK_tasks_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE rca_templates ADD CONSTRAINT FK_rca_templates_organization FOREIGN KEY (organizationId) REFERENCES organizations(id);
ALTER TABLE rca_templates ADD CONSTRAINT FK_rca_templates_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE evidence_categories ADD CONSTRAINT FK_evidence_categories_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE evidence_locations ADD CONSTRAINT FK_evidence_locations_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE production_losses ADD CONSTRAINT FK_production_losses_plan FOREIGN KEY (planId) REFERENCES production_plans(id);
ALTER TABLE production_losses ADD CONSTRAINT FK_production_losses_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE oee_summaries ADD CONSTRAINT FK_oee_summaries_plan FOREIGN KEY (planId) REFERENCES production_plans(id);
ALTER TABLE oee_summaries ADD CONSTRAINT FK_oee_summaries_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE loss_categories ADD CONSTRAINT FK_loss_categories_reconcile_form FOREIGN KEY (reconcileFormId) REFERENCES reconcile_forms(id);
ALTER TABLE loss_categories ADD CONSTRAINT FK_loss_categories_impact_code FOREIGN KEY (impactCodeId) REFERENCES impact_codes(id);
ALTER TABLE loss_categories ADD CONSTRAINT FK_loss_categories_oee_code FOREIGN KEY (oeeCodeId) REFERENCES oee_codes(id);
ALTER TABLE loss_categories ADD CONSTRAINT FK_loss_categories_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE reconcile_forms ADD CONSTRAINT FK_reconcile_forms_loss FOREIGN KEY (lossId) REFERENCES production_losses(id);
ALTER TABLE reconcile_forms ADD CONSTRAINT FK_reconcile_forms_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE unmapped_events ADD CONSTRAINT FK_unmapped_events_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE unmapped_events ADD CONSTRAINT FK_unmapped_events_unit FOREIGN KEY (unitId) REFERENCES units(id);
ALTER TABLE reason_codes ADD CONSTRAINT FK_reason_codes_parent FOREIGN KEY (parentId) REFERENCES reason_codes(id);
ALTER TABLE reason_codes ADD CONSTRAINT FK_reason_codes_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id);
ALTER TABLE dashboard_configurations ADD CONSTRAINT FK_dashboard_configurations_tenant FOREIGN KEY (tenantId) REFERENCES tenants(id); 
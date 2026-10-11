# PI Integration Workflow & Testing Guide
**Date:** July 21, 2025  
**Version:** 1.0  
**Purpose:** Complete step-by-step guide to configure, test, and validate Aveva PI integration with Pro-Act system

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Connection Setup](#phase-1-connection-setup)
4. [Phase 2: AF Hierarchy Binding](#phase-2-af-hierarchy-binding)
5. [Phase 3: Event Type Mapping](#phase-3-event-type-mapping)
6. [Phase 4: Sync Configuration](#phase-4-sync-configuration)
7. [Phase 5: Testing & Validation](#phase-5-testing--validation)
8. [Troubleshooting](#troubleshooting)
9. [Performance Monitoring](#performance-monitoring)

---

## Overview & Architecture

### What This Integration Does
The PI integration connects your Aveva PI system to Pro-Act, automatically converting PI Event Frames into production events that appear in your EventHub tabs. This enables real-time monitoring of production issues, equipment failures, and operational deviations.

### Data Flow
```
PI Event Frames → PI Web API → Pro-Act PI Store → Mapped to App Events → EventHub Tabs
```

### Key Components
- **PI Web API Client**: Connects to your PI system
- **PI Store**: Local storage of PI events and mappings
- **PISyncService**: Converts PI events to Pro-Act events
- **Event Mapper**: Maps PI templates to event types
- **Binding System**: Links PI elements to your units/assets

---

## Prerequisites

### Required Access
- **Pro-Act Role**: SuperAdmin, OrgAdmin, or TenantAdmin
- **PI System Access**: Valid PI Web API credentials
- **Network Access**: Ability to reach PI Web API endpoint

### Required Information
- PI Web API endpoint URL
- PI username/password (or Windows authentication)
- PI Asset Framework (AF) server details
- Knowledge of your production units/assets structure

### System Requirements
- Pro-Act system running and accessible
- PI Web API accessible from Pro-Act server
- Sufficient storage for PI event data

---

## Phase 1: Connection Setup

### Step 1.1: Access Connectivity Page
1. Navigate to **Connectivity** page in Pro-Act
2. Verify you have appropriate permissions
3. Check that PI Event Frames card shows status

### Step 1.2: Configure PI Connection
1. Go to **AVEVA PI Integration** tab
2. Click **Connection** sub-tab
3. Enter connection details:
   - **Base URL**: `https://your-pi-server:port/piwebapi`
   - **Username**: Your PI username (e.g., `DOMAIN\username`)
   - **Password**: Your PI password
4. Click **Test Connection** to verify connectivity
5. Click **Save Settings** to persist configuration

### Step 1.3: Verify Connection Status
**Purpose**: Ensure PI system is reachable and authenticated

**Expected Results**:
- PI Server status shows "Connected" (green)
- Asset Servers list populates with your PI servers
- No authentication errors

**Testing**:
```bash
# Check browser console for any PI API errors
# Verify PI Event Frames card shows green status indicator
# Confirm "Last checked" timestamp updates
```

---

## Phase 2: AF Hierarchy Binding

### Step 2.1: Select PI Scope
1. Go to **AF Hierarchy** sub-tab
2. Choose scope type:
   - **Element (Root)**: For specific production areas
   - **Database**: For entire PI database

### Step 2.2: Navigate PI Structure
1. Select **Asset Server** from dropdown
2. Select **AF Database** (populates after server selection)
3. If using Element scope, select **Root Element**
4. Browse the hierarchy tree to understand structure

### Step 2.3: Bind PI Elements to Pro-Act Units/Assets
**Purpose**: Tell the system which PI elements represent your production units and equipment

**Critical Importance**: Without bindings, PI events cannot be routed to your EventHub because the system doesn't know which unit/asset they belong to.

**Binding Process**:
1. Right-click on PI element in hierarchy
2. Choose **Bind as Unit** or **Bind as Asset**
3. Select corresponding Pro-Act unit/asset
4. Verify binding appears as green badge

**Example Binding**:
```
PI Element: "Production Line 1" → Pro-Act Unit: "Line-001"
PI Element: "Reactor A" → Pro-Act Asset: "REACTOR-A-001"
```

**Testing Bindings**:
- Check binding badges appear on PI elements
- Verify bound elements show correct Pro-Act names
- Test binding details modal shows correct mappings

---

## Phase 3: Event Type Mapping

### Step 3.1: Discover PI Templates
1. Go to **Mapping** sub-tab
2. Set appropriate time range for template discovery
3. Click **Discover templates** button
4. Review discovered templates in Template Catalog

**Purpose**: Find actual PI templates in your system that may not match default names

### Step 3.2: Map Templates to Event Types
**Purpose**: Define which PI template becomes which type of event in your system

**Event Types Available**:
- **ProductionLoss**: Equipment failures, quality issues, production stops
- **IOW**: In-Operation Window deviations (parameter excursions)
- **SOL**: Safety and Operational Limit violations
- **APM**: Asset Performance Management alerts
- **FailureWO**: Work order failures
- **ProductionOutput**: Production quantities, good vs scrap

**Mapping Process**:
1. For each discovered template, select appropriate event type
2. Use **Load attributes** to see available PI attributes
3. Map PI attributes to Pro-Act fields

**Example Mapping**:
```typescript
// PI Template: "Equipment Failure"
// Maps to: ProductionLoss
// Attribute mappings:
{
  "Description": "description",
  "FailureCode": "reasonCodeId",
  "Downtime": "duration",
  "Cost": "cost"
}
```

### Step 3.3: Configure Attribute Mappings
**Purpose**: Map PI event frame attributes to your Pro-Act event fields

**Key Mappings**:
- **Text fields**: Map to `description`, `parameter`, `recommendedAction`
- **Numeric fields**: Map to `quantity`, `cost`, `limit`, `value`
- **Categorical fields**: Map to `reasonCodeId`, `oeeCodeId`, `impactCodeId`

**Testing Mappings**:
- Verify attribute names load correctly
- Check that mapped fields appear in preview
- Save mappings and verify persistence

---

## Phase 4: Sync Configuration

### Step 4.1: Configure Sync Settings
1. Go to **Sync & Status** sub-tab
2. Configure sync parameters:
   - **Auto delta sync**: Enable for real-time updates
   - **Interval (sec)**: Minimum 60 seconds (recommended: 300)
   - **Max concurrent syncs**: Default 5

### Step 4.2: Understanding Sync Types

#### Real-time vs Batch Sync

**Real-time (Auto Delta Sync)**
- **Purpose**: Continuously monitor PI for new events
- **How it works**: Checks PI every 60+ seconds for new Event Frames
- **Use case**: Production monitoring, immediate alerting
- **Configuration**: Enable "Auto delta sync" checkbox

**Batch (Manual Backfill)**
- **Purpose**: Import historical events for analysis
- **How it works**: Manually specify time range to import
- **Use case**: Historical analysis, system setup, data migration
- **Configuration**: Use "Backfill Range" button with custom dates

**Watermark Tracking**
- **Purpose**: Prevent duplicate event imports
- **How it works**: System remembers last sync timestamp per scope
- **Benefits**: Efficient incremental updates, no duplicate events
- **Storage**: Stored in PI Store with scope information

### Step 4.3: Initial Data Import
1. Set appropriate time range (e.g., last 24 hours)
2. Click **Backfill Range** to import historical events
3. Monitor sync progress and results
4. Verify events appear in EventHub

**Testing Sync**:
- Check sync statistics update
- Verify watermark timestamp updates
- Confirm events appear in appropriate EventHub tabs

---

## Phase 5: Testing & Validation

### Step 5.1: Verify Event Creation
1. Navigate to **EventHub** page
2. Check each event type tab for PI-sourced events
3. Verify event details match PI source data

**Expected Results**:
- Events show `source: 'PI'` in event details
- Event types match your mapping configuration
- Events appear in correct units/assets based on bindings

### Step 5.2: Test Real-time Updates
1. Create a test event in PI system (if possible)
2. Wait for auto-sync interval
3. Verify event appears in EventHub
4. Check event details and routing

**Testing Checklist**:
- [ ] PI connection established
- [ ] AF elements bound to units/assets
- [ ] Templates mapped to event types
- [ ] Attributes mapped to fields
- [ ] Initial sync completed
- [ ] Events appear in EventHub
- [ ] Real-time updates working
- [ ] No duplicate events
- [ ] Correct event routing

### Step 5.3: Validate Event Data
**Data Quality Checks**:
- Event timestamps match PI source
- Unit/asset assignments correct
- Event descriptions meaningful
- Numeric values properly converted
- Categorical codes mapped correctly

---

## Troubleshooting

### Common Issues & Solutions

#### Connection Problems
**Symptoms**: PI Server shows "Disconnected"
**Solutions**:
- Verify network connectivity to PI server
- Check PI Web API endpoint URL
- Validate credentials
- Check firewall settings

#### Binding Issues
**Symptoms**: Events don't appear in EventHub
**Solutions**:
- Verify PI elements are bound to Pro-Act units/assets
- Check binding status in AF Hierarchy tab
- Ensure bound elements have PI events

#### Mapping Problems
**Symptoms**: Events appear but with missing/incorrect data
**Solutions**:
- Review template to event type mappings
- Check attribute field mappings
- Verify PI templates exist and have attributes

#### Sync Failures
**Symptoms**: No new events appearing
**Solutions**:
- Check sync status and error messages
- Verify watermark tracking
- Review sync interval settings
- Check PI system for new events

### Debug Information
**Useful Debug Points**:
- Browser console for API errors
- PI Store statistics in Sync tab
- Event frame preview in EF tab
- Binding details in AF Hierarchy

---

## Performance Monitoring

### Key Metrics to Monitor
1. **Sync Performance**: Events per sync cycle
2. **Data Quality**: Mapping success rate
3. **System Impact**: Memory and storage usage
4. **Real-time Latency**: Event detection to display time

### Optimization Tips
1. **Sync Intervals**: Balance real-time needs with system load
2. **Batch Sizes**: Adjust maxCount based on system capacity
3. **Attribute Selection**: Only map necessary attributes
4. **Time Windows**: Use appropriate ranges for backfill

---

## Success Criteria

### Integration Working When:
- [ ] PI events appear in EventHub within sync interval
- [ ] Events are correctly categorized by type
- [ ] Events route to correct units/assets
- [ ] No duplicate events are created
- [ ] Real-time updates function properly
- [ ] Historical data can be imported
- [ ] System performance remains acceptable

### Validation Checklist
- [ ] Connection test passes
- [ ] Bindings established
- [ ] Mappings configured
- [ ] Initial sync successful
- [ ] Real-time sync working
- [ ] Events display correctly
- [ ] Data quality acceptable
- [ ] Performance satisfactory

---

## Next Steps After Integration

1. **Monitor Performance**: Watch sync statistics and system load
2. **Refine Mappings**: Adjust based on actual PI data patterns
3. **Expand Scope**: Add more units/assets as needed
4. **Optimize Settings**: Fine-tune sync intervals and batch sizes
5. **User Training**: Train operators on new PI-sourced events
6. **Process Integration**: Integrate PI events into workflows

---

## Support & Maintenance

### Regular Maintenance Tasks
- Monitor sync statistics weekly
- Review mapping effectiveness monthly
- Update bindings when PI structure changes
- Validate data quality quarterly

### When to Contact Support
- Persistent connection failures
- Data corruption or duplication
- Performance degradation
- Mapping configuration issues

---

**Document Version**: 1.0  
**Last Updated**: July 21, 2025  
**Next Review**: August 21, 2025

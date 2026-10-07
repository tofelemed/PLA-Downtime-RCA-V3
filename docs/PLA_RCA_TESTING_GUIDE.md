# PLA and RCA Testing Guide

This guide provides comprehensive steps to test the Plant Level Analytics (PLA) and Root Cause Analysis (RCA) modules using the seeded test data.

## Table of Contents
1. [Data Seeding Setup](#data-seeding-setup)
2. [PLA Module Testing](#pla-module-testing)
3. [RCA Module Testing](#rca-module-testing)
4. [Integration Testing](#integration-testing)
5. [Troubleshooting](#troubleshooting)

## Data Seeding Setup

### Prerequisites
- Application is running
- IndexedDB is accessible
- User is logged in with appropriate permissions

### Step 1: Seed Test Data

#### Option A: Using Browser Console
1. Open the application in your browser
2. Open Developer Tools (F12)
3. Go to the Console tab
4. Run the following command:
```javascript
// Seed all test data
seedPLARCAData();

// Or clear existing data first
clearPLARCAData();
seedPLARCAData();
```

#### Option B: Using Application UI
1. Navigate to the Production Dashboard
2. The system will automatically initialize sample data if none exists
3. Or go to Codes Management and click "Initialize Sample Data"

### Step 2: Verify Data Seeding
Check that the following data has been created:

#### Organizations and Tenants
- **Organization**: Demo Manufacturing Corp (DEMO)
- **Tenant**: Plant A - Production Facility (PLANT_A)

#### Production Units
- **Line A**: Production Line A (1000 units/hour capacity)
- **Line B**: Production Line B (800 units/hour capacity)
- **Packaging Line**: Packaging Line (1200 units/hour capacity)

#### Assets
- **Line A**: Conveyor Belt A1, Pump A-001, Motor A-001
- **Line B**: Conveyor Belt B1, Pump B-001 (in maintenance)
- **Packaging**: Packaging Machine

#### Products
- Product A - Standard (PROD_A_STD)
- Product A - Premium (PROD_A_PREM)
- Product B - Standard (PROD_B_STD)
- Product B - Premium (PROD_B_PREM)

#### Master Data Codes
- **Impact Codes**: Equipment Failure, Setup Time, Reduced Speed, Quality Defects, Material Shortage, Safety Incident, Environmental Issue
- **OEE Codes**: Planned Maintenance, Unplanned Downtime, Setup and Adjustment, Idling and Minor Stops, Reduced Speed, Startup Rejects, Production Rejects, Safety Stop, Environmental Stop
- **Reason Codes**: Hierarchical structure with Equipment Failure, Process Failure, Material Issues, Personnel Issues, Planned Downtime

#### Production Events
- **Pump A-001 Seal Failure**: 2-hour production loss, $10,000 cost impact
- **Pump B-001 Motor Failure**: 4-hour production loss, $7,500 cost impact
- **Packaging Machine Jam**: 1-hour quality issue, $2,000 cost impact

#### RCA Templates
- **Equipment Failure Template**: For equipment failure investigations
- **Process Deviation Template**: For process deviation investigations

#### RCA Investigations
- **Pump A-001 Seal Failure Investigation**: In Progress, High Priority
- **Pump B-001 Motor Failure Analysis**: Analysis phase, Critical Priority

---

## PLA Module Testing

### 1. Production Dashboard Testing

#### Test Case 1: Dashboard Overview
1. Navigate to **Production Dashboard**
2. **Expected Results**:
   - Dashboard loads with sample data
   - Shows production units (Line A, Line B, Packaging Line)
   - Displays OEE metrics and trends
   - Shows recent production events

#### Test Case 2: Production Events
1. Go to **Event Hub** or **Production Events** section
2. **Expected Results**:
   - List shows 3 seeded production events
   - Events have proper status (Open, In Progress, Closed)
   - Cost impacts are displayed correctly
   - Event details show proper asset and unit associations

#### Test Case 3: OEE Analysis
1. Navigate to **OEE Dashboard** or **Analytics** section
2. **Expected Results**:
   - OEE calculations based on seeded events
   - Availability, Performance, and Quality metrics
   - Trend charts showing historical data
   - Loss categorization by impact codes

#### Test Case 4: Master Data Management
1. Go to **Codes Management**
2. **Expected Results**:
   - Impact codes are properly categorized (Availability, Performance, Quality)
   - OEE codes show correct impact types
   - Reason codes display hierarchical structure
   - All codes have proper descriptions and costs

### 2. Production Planning Testing

#### Test Case 5: Production Plans
1. Navigate to **Production Plans**
2. **Expected Results**:
   - Can create production plans for seeded units
   - Plans reference correct products and units
   - Capacity calculations work with seeded data

#### Test Case 6: Loss Analysis
1. Go to **Loss Analysis** or **Pareto Charts**
2. **Expected Results**:
   - Losses are categorized by impact codes
   - Pareto charts show top loss categories
   - Cost impact calculations are accurate

---

## RCA Module Testing

### 1. RCA Dashboard Testing

#### Test Case 7: RCA Overview
1. Navigate to **RCA Module**
2. **Expected Results**:
   - Shows 2 seeded RCA investigations
   - Displays RCA status and priorities
   - Shows team assignments and target dates

#### Test Case 8: Create New RCA
1. Click **"Create New RCA"**
2. **Test Steps**:
   - Select a production event from the dropdown
   - Choose an RCA template
   - Fill in RCA details (title, description, priority)
   - Assign team members
   - Set target close date
3. **Expected Results**:
   - RCA is created successfully
   - Logic tree is populated from template
   - RCA appears in the dashboard

#### Test Case 9: RCA Logic Tree
1. Open an existing RCA investigation
2. **Test Steps**:
   - Navigate to **Logic Tree** tab
   - Expand/collapse tree nodes
   - Add new nodes (Why questions, Causes)
   - Edit node descriptions and notes
   - Mark findings as key findings
3. **Expected Results**:
   - Tree structure is maintained
   - Changes are saved properly
   - Node relationships are preserved

#### Test Case 10: Evidence Collection
1. Go to **Evidence** tab in an RCA
2. **Test Steps**:
   - Add different types of evidence (Photo, Document, Note, Time Series)
   - Attach evidence to logic tree nodes
   - Add evidence categories and locations
   - Set severity levels
3. **Expected Results**:
   - Evidence is properly categorized
   - File attachments work (if applicable)
   - Evidence is linked to relevant nodes

#### Test Case 11: Recommendations
1. Navigate to **Recommendations** tab
2. **Test Steps**:
   - Create new recommendations
   - Assign recommendations to team members
   - Set due dates and estimated costs
   - Track recommendation status
3. **Expected Results**:
   - Recommendations are properly tracked
   - Status updates work correctly
   - Cost tracking is accurate

### 2. RCA Templates Testing

#### Test Case 12: Template Management
1. Go to **RCA Settings** > **Templates**
2. **Expected Results**:
   - Shows 2 seeded templates
   - Templates have proper logic tree structures
   - Verification checklists are included

#### Test Case 13: Create Custom Template
1. Click **"Create New Template"**
2. **Test Steps**:
   - Define template name and category
   - Build custom logic tree structure
   - Add verification checklist items
   - Save template
3. **Expected Results**:
   - Template is saved successfully
   - Can be used for new RCA investigations
   - Logic tree structure is preserved

---

## Integration Testing

### 1. Event to RCA Integration

#### Test Case 14: Event-Driven RCA Creation
1. Go to **Event Hub**
2. **Test Steps**:
   - Select a production event
   - Click **"Initiate RCA"** or **"Create RCA"**
   - Verify event data is pre-populated in RCA form
3. **Expected Results**:
   - RCA is linked to the selected event
   - Event details are copied to RCA
   - RCA status is properly initialized

### 2. Data Consistency Testing

#### Test Case 15: Cross-Module Data Consistency
1. **Test Steps**:
   - Create a new production event
   - Create an RCA for that event
   - Update event status
   - Verify RCA reflects the changes
2. **Expected Results**:
   - Data remains consistent across modules
   - Updates propagate correctly
   - No data corruption occurs

### 3. Performance Testing

#### Test Case 16: Large Dataset Handling
1. **Test Steps**:
   - Create multiple production events (10+)
   - Create multiple RCAs (5+)
   - Navigate between different views
   - Test search and filtering
2. **Expected Results**:
   - Application remains responsive
   - Data loads efficiently
   - Search and filter work correctly

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Data Not Seeding
**Symptoms**: No test data appears after running seeding script
**Solutions**:
1. Check browser console for errors
2. Verify IndexedDB is accessible
3. Clear browser cache and try again
4. Check if user has proper permissions

#### Issue 2: RCA Logic Tree Not Loading
**Symptoms**: Logic tree appears empty or corrupted
**Solutions**:
1. Check if RCA template is properly seeded
2. Verify template logic tree structure
3. Try creating a new RCA with a different template
4. Check browser console for JavaScript errors

#### Issue 3: Production Events Not Showing
**Symptoms**: Event Hub shows no events
**Solutions**:
1. Verify production events were seeded
2. Check tenant ID matches between seeding and display
3. Verify event status filters
4. Check if events are associated with correct units/assets

#### Issue 4: OEE Calculations Incorrect
**Symptoms**: OEE metrics don't match expected values
**Solutions**:
1. Verify production events have correct durations
2. Check if impact codes are properly categorized
3. Verify unit capacity and cycle time settings
4. Check if events are properly closed

### Debugging Commands

Use these commands in the browser console for debugging:

```javascript
// Check if data is seeded
console.log('Events:', await masterDataService.getProductionEvents({ tenantId: 'demo-tenant-001' }));
console.log('RCAs:', await masterDataService.getRCAs({ tenantId: 'demo-tenant-001' }));
console.log('Templates:', await masterDataService.getRCATemplates({ tenantId: 'demo-tenant-001' }));

// Clear and reseed data
clearPLARCAData();
seedPLARCAData();

// Check IndexedDB contents
console.log('IndexedDB stores:', Array.from((await indexedDB.open('ProActDB')).result.objectStoreNames));
```

### Performance Monitoring

Monitor these metrics during testing:
- Page load times
- Data query response times
- Memory usage
- IndexedDB operation performance

### Data Validation

Verify data integrity by checking:
- All required fields are populated
- Relationships between entities are maintained
- Calculated fields are accurate
- Status transitions are valid

---

## Test Data Cleanup

### Clearing Test Data
```javascript
// Clear all test data
clearPLARCAData();
```

### Resetting Test Data
```javascript
// Reset all test data (clear and reseed)
resetPLARCAData();
```

### Manual Cleanup
If automated cleanup fails:
1. Clear browser IndexedDB manually
2. Refresh the application
3. Re-run the seeding script

---

## Success Criteria

A successful test should demonstrate:
1. ✅ All seeded data loads correctly
2. ✅ PLA dashboard shows accurate metrics
3. ✅ RCA investigations can be created and managed
4. ✅ Logic trees function properly
5. ✅ Evidence collection works
6. ✅ Recommendations can be tracked
7. ✅ Data remains consistent across modules
8. ✅ Performance is acceptable with test data volume

---

## Next Steps

After successful testing:
1. Document any issues found
2. Create additional test scenarios as needed
3. Consider adding more complex test data
4. Test with different user roles and permissions
5. Validate with real production data patterns

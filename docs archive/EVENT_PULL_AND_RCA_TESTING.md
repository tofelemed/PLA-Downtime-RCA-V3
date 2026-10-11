# Event Pulling and RCA Creation Testing Guide

## Overview

This document describes the comprehensive E2E tests for the complete event workflow:
1. **Pulling events** from external sources (PI, OPC UA, Modbus, MQTT, etc.)
2. **Displaying events** in EventHub
3. **Creating RCA** based on trigger rules
4. **Full workflow** integration

## Test File

**Location:** `e2e/event-pull-and-rca.spec.ts`

## Test Coverage

### 1. Event Pulling Tests

#### `PULL: should get available event sources`
- Tests the `/connectivity/event-sources` endpoint
- Verifies that available sources are returned
- Logs source types for debugging

#### `PULL: should pull events from PI (if connection exists)`
- Tests pulling events from PI system
- Requires an active PI connection
- Pulls events from last 7 days
- Verifies events are created in the system
- Automatically tracks created events for cleanup

#### `PULL: should create production event manually for testing`
- Creates a test event with high cost to trigger RCA rules
- Used for testing RCA trigger functionality

### 2. EventHub Display Tests

#### `EVENTHUB: should display events in EventHub UI`
- Navigates to EventHub page
- Verifies page loads correctly
- Checks for event-related UI elements
- Verifies events table/list is visible

#### `EVENTHUB: should filter events by type`
- Tests event filtering by type (Production Loss, IOW, SOL, etc.)
- Clicks on event type tabs
- Verifies filtering works

#### `EVENTHUB: should search events`
- Tests event search functionality
- Searches for specific events
- Verifies search results

### 3. RCA Trigger Rules Tests

#### `RCA RULES: should check if event meets RCA trigger criteria`
- Creates a high-cost, critical severity event
- Fetches RCA trigger configuration
- Verifies event meets trigger criteria
- Tests rule evaluation logic

#### `RCA RULES: should show RCA button for qualifying events in UI`
- Creates a qualifying event
- Navigates to EventHub
- Searches for the event
- Verifies "Create RCA" button is visible for qualifying events

### 4. RCA Creation Tests

#### `RCA CREATE: should create RCA from event via API`
- Creates a test event
- Creates RCA via API for that event
- Verifies RCA is created with correct event linkage
- Tests API-based RCA creation

#### `RCA CREATE: should create RCA from event via UI`
- Creates a qualifying event
- Navigates to EventHub
- Searches for the event
- Clicks "Create RCA" button
- Verifies navigation to RCA page or dialog opens

### 5. Full Workflow Tests

#### `WORKFLOW: should complete full event pull → display → RCA creation workflow`
- **Step 1:** Creates a test event (simulating event pull)
- **Step 2:** Verifies event appears in EventHub
- **Step 3:** Creates RCA for the event
- **Step 4:** Verifies RCA is linked to event

#### `WORKFLOW: should handle event with RCA trigger rules`
- Creates event that should trigger RCA based on rules
- Verifies event is visible in EventHub
- Checks if RCA button is shown based on trigger rules
- Tests rule-based RCA triggering

## Running the Tests

### Run All Event Pull and RCA Tests
```bash
npm run test:e2e -- e2e/event-pull-and-rca.spec.ts
```

### Run with UI (Interactive Mode)
```bash
npm run test:e2e:ui -- e2e/event-pull-and-rca.spec.ts
```

### Run in Headed Mode (See Browser)
```bash
npm run test:e2e:headed -- e2e/event-pull-and-rca.spec.ts
```

### Run Specific Test
```bash
npm run test:e2e -- e2e/event-pull-and-rca.spec.ts -g "WORKFLOW: should complete full"
```

## Prerequisites

### 1. Backend Running
The backend must be running on `http://localhost:4004`

### 2. Test User
A test user is automatically created with:
- Email: `test@example.com`
- Password: `Test123!@#`
- Role: `SuperAdmin`

### 3. PI Connection (Optional)
For PI event pulling tests:
- An active PI connection must exist for the test tenant
- Tests will skip if no PI connection is found

### 4. Master Data
Tests automatically create:
- Organization
- Tenant
- Production Unit
- Product

All test data is cleaned up after tests complete.

## Test Data Cleanup

The test suite automatically:
1. Tracks all created events (`createdEventIds`)
2. Tracks all created RCAs (`createdRcaIds`)
3. Cleans up all test data in `afterAll` hook
4. Handles cleanup errors gracefully

## Expected Behavior

### Event Pulling
- Events should be pulled from configured sources
- Events should be stored in the database
- Production events should be created automatically if `autoCreateProductionEvents: true`

### EventHub Display
- Events should be visible in EventHub UI
- Events should be filterable by type
- Events should be searchable
- Event details should be accessible

### RCA Trigger Rules
- Events meeting trigger criteria should show "Create RCA" button
- Events not meeting criteria should not show button (unless manual creation allowed)
- Trigger rules should be evaluated correctly

### RCA Creation
- RCA should be created successfully
- RCA should be linked to the event
- RCA should be accessible via API and UI

## Troubleshooting

### Tests Skipping
- **PI Connection Missing:** Some tests skip if no PI connection exists. This is expected.
- **Event Not Visible:** UI tests may skip if events are not visible due to filtering or pagination.

### Test Failures
- **Authentication Errors:** Ensure backend is running and test user exists
- **API Errors:** Check backend logs for detailed error messages
- **UI Timeouts:** Increase timeout values if page loads slowly

### Debugging
- Use `--headed` mode to see browser actions
- Use `--debug` mode to step through tests
- Check browser console for JavaScript errors
- Check backend logs for API errors

## Integration with Other Tests

These tests work alongside:
- `e2e/production-plans-crud.spec.ts` - Production plan tests
- `e2e/master-data.spec.ts` - Master data tests
- `e2e/auth.spec.ts` - Authentication tests

All tests share the same test fixture system for consistent data setup.


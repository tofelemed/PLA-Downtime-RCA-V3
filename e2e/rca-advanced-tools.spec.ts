/**
 * RCA Advanced Analysis Tools E2E Tests
 * Validates all six methodology APIs: 5-Why, Fishbone, FMEA, Fault Tree, Barrier, Change
 */

import { test, expect } from '@playwright/test';
import { createTestFixture, TestFixture } from './test-utils/test-fixtures';
import { apiRequest, EntityRef } from './test-utils/api-helpers';

interface UserProfile {
  id?: string;
  userId?: string;
}

interface AnalysisRecord {
  id: string;
  rcaId: string;
  rootCause?: string;
}

test.describe('RCA advanced analysis tools API', () => {
  let fixture: TestFixture;
  let rcaId: string;
  const createdIds: {
    fiveWhy?: string;
    fishbone?: string;
    fmea?: string;
    faultTree?: string;
    barrier?: string;
    change?: string;
    rca?: string;
    event?: string;
  } = {};

  test.beforeAll(async () => {
    fixture = await createTestFixture();
    const { tokens, tenant, unit } = fixture;

    const event = await apiRequest<EntityRef>('/production-events', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        eventId: `E2E-ADV-RCA-${Date.now()}`,
        eventType: 'ProductionLoss',
        description: `Advanced RCA tools test event ${Date.now()}`,
        unitId: unit.id,
        tenantId: tenant.id,
        startTime: new Date().toISOString(),
        source: 'Manual',
        status: 'Open',
      }),
    });
    createdIds.event = event.id;

    const userProfile = await apiRequest<UserProfile>('/auth/profile', {
      method: 'GET',
      token: tokens.accessToken,
    });
    const teamLeadId = userProfile.userId || userProfile.id || (tokens as { user?: { id?: string; userId?: string } }).user?.id || (tokens as { user?: { userId?: string } }).user?.userId;
    if (!teamLeadId) {
      throw new Error('Could not resolve teamLeadId from auth profile');
    }

    const rca = await apiRequest<EntityRef>('/rcas', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        eventId: event.id,
        title: `Advanced Tools RCA ${Date.now()}`,
        description: 'RCA for advanced methodology tool testing',
        status: 'Analysis',
        priority: 'High',
        teamLeadId,
        teamMemberIds: [],
        recommendations: '[]',
        evidence: '[]',
      }),
    });
    rcaId = rca.id;
    createdIds.rca = rca.id;
  });

  test.afterAll(async () => {
    const { tokens } = fixture;
    const deletes = [
      createdIds.fiveWhy && `/rca-analysis/five-why/${createdIds.fiveWhy}`,
      createdIds.fishbone && `/rca-analysis/fishbone/${createdIds.fishbone}`,
      createdIds.fmea && `/rca-analysis/fmea/${createdIds.fmea}`,
      createdIds.faultTree && `/rca-analysis/fault-tree/${createdIds.faultTree}`,
      createdIds.barrier && `/rca-analysis/barrier/${createdIds.barrier}`,
      createdIds.change && `/rca-analysis/change/${createdIds.change}`,
      createdIds.rca && `/rcas/${createdIds.rca}`,
      createdIds.event && `/production-events/${createdIds.event}`,
    ].filter(Boolean) as string[];

    for (const path of deletes) {
      try {
        await apiRequest(path, { method: 'DELETE', token: tokens.accessToken });
      } catch {
        /* ignore cleanup errors */
      }
    }
    await fixture.cleanup();
  });

  test('create and fetch all six methodology types for an RCA', async () => {
    const { tokens, tenant } = fixture;
    const tenantId = tenant.id;

    const fiveWhy = await apiRequest<AnalysisRecord>('/rca-analysis/five-why', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        rcaId,
        tenantId,
        problem: 'Pump failure',
        whyLevels: [{ level: 1, question: 'Why?', answer: 'Seal leak' }],
        rootCause: 'Seal leak',
      }),
    });
    createdIds.fiveWhy = fiveWhy.id;
    expect(fiveWhy.rcaId).toBe(rcaId);

    const fishbone = await apiRequest<AnalysisRecord>('/rca-analysis/fishbone', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        rcaId,
        tenantId,
        effect: 'Pump failure',
        categories: [{ id: 'c1', name: 'Machine', causes: [] }],
      }),
    });
    createdIds.fishbone = fishbone.id;

    const fmea = await apiRequest<AnalysisRecord>('/rca-analysis/fmea', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        rcaId,
        tenantId,
        failureMode: 'Seal failure',
        effects: [{ id: 'e1', description: 'Leak', severity: 8, currentControls: 'Inspection', detection: 4 }],
        causes: [{ id: 'c1', description: 'Wear', occurrence: 6, rpn: 192, recommendedActions: ['Replace seal'] }],
      }),
    });
    createdIds.fmea = fmea.id;

    const faultTree = await apiRequest<AnalysisRecord>('/rca-analysis/fault-tree', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        rcaId,
        tenantId,
        topEvent: 'Pump stopped',
        nodes: [{ id: 'n1', type: 'BasicEvent', description: 'Seal failed' }],
      }),
    });
    createdIds.faultTree = faultTree.id;

    const barrier = await apiRequest<AnalysisRecord>('/rca-analysis/barrier', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        rcaId,
        tenantId,
        hazard: 'High pressure leak',
        barriers: [{
          id: 'b1',
          type: 'Prevention',
          description: 'Pressure relief',
          effectiveness: 'Failed',
          recommendations: [],
        }],
      }),
    });
    createdIds.barrier = barrier.id;

    const change = await apiRequest<AnalysisRecord>('/rca-analysis/change', {
      method: 'POST',
      token: tokens.accessToken,
      body: JSON.stringify({
        rcaId,
        tenantId,
        question: 'What changed?',
        changes: [{
          id: 'ch1',
          category: 'Process',
          description: 'New operator',
          changeDate: '2026-01-01',
          relatedToIncident: true,
          impactLevel: 'High',
        }],
      }),
    });
    createdIds.change = change.id;

    const fetched = await Promise.all([
      apiRequest<AnalysisRecord>(`/rca-analysis/five-why?rcaId=${rcaId}&tenantId=${tenantId}`, { token: tokens.accessToken }),
      apiRequest<AnalysisRecord>(`/rca-analysis/fishbone?rcaId=${rcaId}&tenantId=${tenantId}`, { token: tokens.accessToken }),
      apiRequest<AnalysisRecord>(`/rca-analysis/fmea?rcaId=${rcaId}&tenantId=${tenantId}`, { token: tokens.accessToken }),
      apiRequest<AnalysisRecord>(`/rca-analysis/fault-tree?rcaId=${rcaId}&tenantId=${tenantId}`, { token: tokens.accessToken }),
      apiRequest<AnalysisRecord>(`/rca-analysis/barrier?rcaId=${rcaId}&tenantId=${tenantId}`, { token: tokens.accessToken }),
      apiRequest<AnalysisRecord>(`/rca-analysis/change?rcaId=${rcaId}&tenantId=${tenantId}`, { token: tokens.accessToken }),
    ]);

    for (const record of fetched) {
      expect(record?.rcaId).toBe(rcaId);
    }

    const updatedFiveWhy = await apiRequest<AnalysisRecord>(`/rca-analysis/five-why/${fiveWhy.id}`, {
      method: 'PUT',
      token: tokens.accessToken,
      body: JSON.stringify({ rootCause: 'Worn seal due to overdue maintenance' }),
    });
    expect(updatedFiveWhy.rootCause).toContain('maintenance');
  });
});

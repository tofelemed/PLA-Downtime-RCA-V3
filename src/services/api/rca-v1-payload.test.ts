import { describe, expect, it } from 'vitest';
import type { RCA } from '../MasterDataService';
import { buildCreateRcaPayload, buildUpdateRcaPayload, mapRcaDto } from './rca-v1-payload';

/** The v1 backend DTO's declared fields (`server/pro-act-backend/src/rca/dto/create-rca.dto.ts`). */
const V1_FIELDS = [
  'eventId', 'title', 'description', 'status', 'teamLeadId', 'teamMemberIds', 'priority', 'targetCloseDate', 'actualCloseDate',
  'rootCause', 'recommendations', 'logicTree', 'evidence', 'templateId', 'teamCharter', 'eventDiagram', 'preFailureRate',
  'postFailureRate', 'failureCostPerIncident', 'implementationCost', 'timeToResolution', 'timeToImplementation',
  'effectivenessScore', 'lastUpdated', 'trackingNotes', 'phaseTimeline', 'calculatedROI', 'costSavings', 'downtimeReduction',
  'productivityImprovement',
];

describe('v1 RCA payloads (flag-off plants, plan 3.9)', () => {
  it('create sends only fields the v1 DTO declares (the old builder sent teamMembers / tenantId → 400)', () => {
    const body = buildCreateRcaPayload({
      eventId: 'loss_123',
      title: 'Trip',
      description: 'x',
      status: 'Draft',
      teamLeadId: '2f1b4a6e-2222-4c3d-8e9f-000000000001',
      teamMemberIds: ['2f1b4a6e-2222-4c3d-8e9f-000000000001'],
      priority: 'High',
      recommendations: [],
      evidence: [],
      tenantId: 'tenant-a',
    } as unknown as Omit<RCA, 'id' | 'createdAt' | 'updatedAt'>);
    expect(Object.keys(body).every((key) => V1_FIELDS.includes(key))).toBe(true);
    expect(body).not.toHaveProperty('eventId');
    expect(body.recommendations).toEqual([]);
  });

  it('update keeps arrays and drops undefined fields; the response JSON text is parsed back', () => {
    expect(buildUpdateRcaPayload({ logicTree: [] })).toEqual({ logicTree: [] });
    const rca = mapRcaDto({ id: 'r', title: 't', teamMemberIds: '["a"]', recommendations: '[{"title":"x"}]', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z' });
    expect(rca.teamMemberIds).toEqual(['a']);
    expect(rca.recommendations).toHaveLength(1);
  });
});

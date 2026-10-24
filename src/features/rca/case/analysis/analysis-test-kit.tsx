import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { configureV2Session } from '@/api/v2/config';
import type { RcaAnalysesView } from '@/api/v2/types/rca-analyses';
import type { RcaCaseView, RcaEvidenceItem } from '@/api/v2/types/rca';
import { CaseWorkspaceContext } from '../case-context';

/** Test kit of the analysis pages: a case with saved tools, and a workspace wrapper (read-only or editable). */
const META = { rowVersion: 1, updatedAt: '2026-10-18T14:28:00Z' };

const evidenceItem = (id: string, title: string, nodeIds: string[]): RcaEvidenceItem => ({
  id, title, description: null, type: 'Document', source: null, collectedAt: null, collectedBy: null, category: null, location: null,
  occurredAt: null, assetId: null, severity: null, tags: [], verified: null, fiveP: null, task: null, nodeIds,
} as unknown as RcaEvidenceItem);

export const KIT_CASE: RcaCaseView = {
  id: 'c1', title: 'Gearbox trip', status: 'Closed', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: 'Extruder stopped', teamMemberIds: [], rootCause: 'Inspection gap', templateId: null, teamCharter: null,
  recommendations: [],
  evidence: [evidenceItem('ev-1', 'Oil sample', ['ln-1'])],
  logicTree: [{ id: 'ln-1', parentId: null, label: 'Gearbox trips', kind: 'Equipment', status: null, notes: null, code: 'GB', description: 'Teeth worn', verified: true }],
  eventDiagram: {
    nodes: [
      { id: 'event-1', label: 'Trip alarm', type: 'Failure', timestamp: null, description: null, asset: 'EXT1', severity: 'High', position: { x: 0, y: 0 } },
      { id: 'event-2', label: 'Drive stops', type: 'Failure', timestamp: null, description: null, asset: null, severity: 'Low', position: { x: 0, y: 140 } },
    ],
    edges: [],
  },
  createdBy: 'u-author', consequenceClass: null, residualRisk: null, closureRequestedBy: null, closureRequestedAt: null,
  closureApprovedBy: null, closureApprovedAt: null, closureNote: null, effectivenessVerdict: null,
};

export const KIT_ANALYSES: RcaAnalysesView = {
  fiveWhy: { id: 'fw', ...META, problem: 'Extruder stopped for an hour', whyLevels: [{ level: 1, question: 'Why did this happen?', answer: 'Gear teeth worn', justification: 'ev-1 photographs' }], rootCause: 'Inspection gap' },
  fishbone: { id: 'fb', ...META, effect: 'Gearbox trip', categories: [{ id: 'cat-1', name: 'Material', causes: [{ id: 'cause-1', description: 'Oil contaminated', isPrimary: true, likelihood: 'High' }] }] },
  fmea: {
    id: 'fm', ...META, failureMode: 'Gearbox loses drive', complete: true, method: 'rpn', rpnThreshold: 100, severityReview: 9,
    effects: [{ id: 'effect-1', description: 'Full stop', severity: 7, currentControls: 'Trip alarm' }],
    causes: [{ id: 'cause-1', description: 'Lubricant contamination', occurrence: 5, detection: 8, detectionControl: 'Oil sample', recommendedActions: ['Set limits', 'Sample monthly'], severity: 7, rpn: 280, actionPriority: 'high', needsAction: true, missing: [] }],
  },
  faultTree: { id: 'ft', ...META, topEvent: 'Gearbox trip', topEventProbability: null, topEventProbabilityReason: 'probability_missing', nodes: [{ id: 'node-1', type: 'BasicEvent', description: 'Seal leak', parentId: null, probability: 0.1 }] },
  barrier: { id: 'br', ...META, hazard: 'Contaminated oil', barriers: [{ id: 'barrier-1', type: 'Detection', description: 'Oil sampling', effectiveness: 'Failed', failureReason: 'Interval too long', recommendations: ['Monthly sampling'] }] },
  change: { id: 'ch', ...META, question: 'What changed?', changes: [{ id: 'change-1', category: 'Equipment', description: 'Breather replaced late', changeDate: '2026-09-01', relatedToIncident: true, impactLevel: 'High' }] },
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/** Stubs ResizeObserver (diagram, selects) and answers every GET with the kit's analyses / an empty list / readiness 404. */
export function stubAnalysesFetch(analyses: RcaAnalysesView = KIT_ANALYSES) {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/analyses')) return json(analyses);
    if (path.endsWith('/readiness')) return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
    return json({ items: [], nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });
  }));
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
}

/** Renders a node inside the case workspace of the kit's case. */
export function renderInCase(node: ReactNode, readOnly: boolean, rca: RcaCaseView = KIT_CASE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CaseWorkspaceContext.Provider value={{ rca, readOnly, canWrite: !readOnly, closed: readOnly, basePath: '/rca/c1' }}>{node}</CaseWorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

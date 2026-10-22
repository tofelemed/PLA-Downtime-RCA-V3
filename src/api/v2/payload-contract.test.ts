import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, toCreateBody, toPatchBody, type EventFormValues } from '@/features/event-hub/model/event-form';
import { FAILURE_FIELDS } from '@/features/event-hub/model/failure-form';
import { fxCreateBody } from '@/features/finance/model/fx-form';
import { policyCreateBody, policyFormOf } from '@/features/finance/model/policy-form';
import type { LogicTreeNode } from '@/features/master-data/api/master-data-types';
import { assetBodyOf, assetDraftOf } from '@/features/master-data/assets/asset-form-model';
import { productChangeOf, productCreateOf, productDraftOf } from '@/features/master-data/products/product-form-model';
import { templateBodyOf } from '@/features/master-data/rca/template-form-model';
import { unitBodyOf } from '@/features/master-data/units/unit-form-model';
import { adjustmentBody, emptyAdjustment } from '@/features/plan-dashboard/model/adjustment-form';
import { dispositionBody, emptyDisposition } from '@/features/plan-dashboard/model/disposition-form';
import { emptyPlanForm, planChangeBody, planCreateBody, type PlanFormValues } from '@/features/plans-profiles-calendars/model/plan-form';
import { buildActionBody, EMPTY_ACTION_FORM } from '@/features/rca/model/action-form';
import { buildCauseBody } from '@/features/rca/model/cause-form';
import { actionTask } from '@/features/rca/model/task-payload';
import { EMPTY_TASK_FORM, toCreateTask, toUpdateTask } from '@/features/tasks/model/task-form';
import { contractProblems } from '@/test/openapi-contract';

/**
 * Contract of the main command builders against `server/pro-act-backend/openapi/v2.json`: the global
 * ValidationPipe is `whitelist + forbidNonWhitelisted`, so a property the request schema does not declare
 * is a 400/422 "Some values were not accepted" in production. Each builder gets every optional input
 * filled, so every property it can send is checked.
 */
const TZ = 'Asia/Tehran';
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const failure = Object.fromEntries(FAILURE_FIELDS.map((field) => [field, `${field} text`]));

const downtime: EventFormValues = {
  ...EMPTY_FORM,
  ...failure,
  unitId: ID(1),
  assetId: ID(2),
  startLocal: '2026-10-18T08:00',
  endLocal: '2026-10-18T09:30',
  physicalType: 'downtime',
  scheduleClass: 'unplanned',
  oeeComponent: 'availability',
  reasonCodeId: ID(3),
  investigationPending: true,
  description: 'Gearbox trip',
  impactMode: 'fractional',
  impactPercent: '25',
  originUnitId: ID(4),
  originAssetId: ID(5),
  plannedEndLocal: '2026-10-18T09:00',
};

const quality: EventFormValues = { ...downtime, physicalType: 'quality_loss', quantity: '12.5', quantityUom: 't', dispositionClass: 'rework' };

const dirtyTree = [
  { id: 'n1', name: 'Drive', code: 'DRV', category: 'Equipment', note: 'v1', finding: true, type: 'legacy', level: 1, children: [{ id: 'n2', name: 'Bearing', code: 'BRG', category: 'Equipment', x: 10, y: 20 }] },
] as unknown as LogicTreeNode[];

const plan: PlanFormValues = {
  ...emptyPlanForm(),
  name: 'October',
  unitId: ID(1),
  scenarioId: ID(2),
  validFrom: '2026-10-01',
  validTo: '2026-11-01',
  headerTarget: '3000',
  slices: [{ productId: ID(3), campaignFrom: '2026-10-01', campaignTo: '2026-11-01', weight: '1', target: '3000' }],
  changeReason: 'Revised demand',
};
const period = { utcStart: '2026-10-18T04:30:00.000Z', utcEnd: '2026-10-18T16:30:00.000Z' };

const CASES: ReadonlyArray<{ name: string; route: string; method: 'post' | 'put' | 'patch'; body: () => unknown }> = [
  { name: 'event create (downtime, failure detail)', route: '/api/v2/production-events', method: 'post', body: () => toCreateBody(downtime, TZ) },
  { name: 'event create (quality loss)', route: '/api/v2/production-events', method: 'post', body: () => toCreateBody(quality, TZ) },
  {
    name: 'event edit (every field changed, with a change reason)',
    route: '/api/v2/production-events/{id}',
    method: 'patch',
    body: () => toPatchBody({ ...EMPTY_FORM, unitId: ID(1), startLocal: '2026-10-18T07:00' }, { ...quality, changeReason: 'Operator note' }, TZ),
  },
  { name: 'asset create', route: '/api/v2/assets', method: 'post', body: () => assetBodyOf({ ...assetDraftOf(null, ID(1)), code: 'P-101', name: 'Pump', description: 'd', manufacturer: 'm', model: 'x', serialNumber: 's', location: 'l' }) },
  { name: 'asset change', route: '/api/v2/assets/{id}', method: 'patch', body: () => assetBodyOf({ ...assetDraftOf(null, ID(1)), code: 'P-101', name: 'Pump' }) },
  { name: 'unit create', route: '/api/v2/units', method: 'post', body: () => unitBodyOf({ code: 'EXT1', name: 'Extruder 1', siteId: ID(6), description: 'd', unitOfMeasure: 't', capacity: '12.5', idealCycleTimeSeconds: '3' }) },
  { name: 'product create', route: '/api/v2/products', method: 'post', body: () => productCreateOf({ ...productDraftOf(null), code: 'HD1', name: 'HDPE', uom: 't', description: 'd', legacyStandardCost: '1.5' }) },
  { name: 'product change', route: '/api/v2/products/{id}', method: 'patch', body: () => productChangeOf({ ...productDraftOf(null), code: 'HD1', name: 'HDPE' }) },
  {
    name: 'RCA template (a stored tree read back with extra keys)',
    route: '/api/v2/rca-templates/{id}',
    method: 'patch',
    body: () => templateBodyOf({ name: 'Drive', category: 'Equipment', description: '', checklistIds: [ID(9)], logicTree: dirtyTree }),
  },
  {
    name: 'valuation policy with a commissioning backdate',
    route: '/api/v2/valuation-policies',
    method: 'post',
    body: () => policyCreateBody({ ...policyFormOf(null), backdate: { effectiveFrom: '2026-01-01T00:00:00.000Z', reason: 'Commissioning' }, restateApproved: true, notes: 'n' }),
  },
  {
    name: 'FX rate',
    route: '/api/v2/fx-rates',
    method: 'post',
    body: () => fxCreateBody({ rateType: 'economic', fromCurrency: 'USD', toCurrency: 'IRR', rate: '42000', effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveTo: '2026-11-01T00:00:00.000Z', source: 'CBI', provisional: true }),
  },
  {
    name: 'RCA action',
    route: '/api/v2/rcas/{id}/actions',
    method: 'post',
    body: () =>
      buildActionBody(
        { ...EMPTY_ACTION_FORM, title: 'Replace bearing', ownerId: ID(1), actionType: 'repair', dueDate: '2026-10-30', windowStart: '2026-11-01', windowEnd: '2026-12-01', baselineMetric: 'recurrences', baselineDays: '90', claimed: '1000', claimedCurrency: 'USD', recommendationId: 'rec-1', verificationMethod: 'Inspection', verifierId: ID(2) },
        TZ,
      ),
  },
  { name: 'RCA cause', route: '/api/v2/rcas/{id}/causes', method: 'post', body: () => buildCauseBody({ kind: 'root', causeCodeId: ID(3), statement: 'Lubrication missed', evidenceIds: ['ev-1'], nodeIds: ['n1'] }) },
  {
    name: 'task create',
    route: '/api/v2/tasks',
    method: 'post',
    body: () => toCreateTask({ ...EMPTY_TASK_FORM, title: 'Check', description: 'd', assigneeId: ID(1), dueDate: '2026-10-30', linkType: 'RCA', linkId: ID(2) }, (day) => `${day}T20:30:00.000Z`),
  },
  {
    name: 'task change',
    route: '/api/v2/tasks/{id}',
    method: 'patch',
    body: () => toUpdateTask({ ...EMPTY_TASK_FORM, title: 'New', description: 'd', assigneeId: ID(3), priority: 'High', status: 'In Progress', dueDate: '2026-10-30' }, { ...EMPTY_TASK_FORM, linkType: 'RCA', linkId: ID(2) }, (day) => `${day}T20:30:00.000Z`),
  },
  { name: 'plan create', route: '/api/v2/production-plans', method: 'post', body: () => planCreateBody(plan, TZ) },
  { name: 'plan version edit', route: '/api/v2/production-plans/{id}/versions/{version}', method: 'patch', body: () => planChangeBody(plan, TZ) },
  {
    name: 'actuals adjustment',
    route: '/api/v2/actuals/adjustments',
    method: 'post',
    body: () => adjustmentBody({ ...emptyAdjustment(ID(1)), quantity: '-5', reason: 'Weighbridge', evidenceRef: 'T-1', windowFrom: period.utcStart, windowTo: period.utcEnd }),
  },
  {
    name: 'lot disposition (recovery correction)',
    route: '/api/v2/lot-dispositions',
    method: 'post',
    body: () =>
      dispositionBody(
        { ...emptyDisposition(period, ID(2)), lotCode: 'L-1', quantity: '4', labReleasedAt: period.utcEnd, evidenceRef: 'Lab 7', reason: 'Off spec', recovery: true, recoveryOfId: ID(3), supersedesId: ID(4) },
        { unitId: ID(1), uom: 't' },
      ),
  },
  { name: 'task of an RCA action', route: '/api/v2/tasks', method: 'post', body: () => actionTask({ id: ID(1), title: 'Case' }, { id: ID(2), title: 'Action', ownerId: ID(3), dueDate: '2026-10-30T00:00:00.000Z' }, ID(4)) },
];

describe('command payloads match the OpenAPI v2 request schemas', () => {
  it.each(CASES)('$name', ({ route, method, body }) => {
    expect(contractProblems(route, method, body())).toEqual([]);
  });

  it('the check itself catches an undeclared property and a missing required one', () => {
    const problems = contractProblems('/api/v2/assets', 'post', { code: 'A', name: 'B', rowVersion: 3 });
    expect(problems).toEqual([
      'body.rowVersion is not declared (the server answers "property rowVersion should not exist")',
      'body.unitId is required',
    ]);
    expect(contractProblems('/api/v2/rca-templates/{id}', 'patch', { logicTree: dirtyTree })).toEqual([
      'body.logicTree[0].type is not declared (the server answers "property type should not exist")',
      'body.logicTree[0].level is not declared (the server answers "property level should not exist")',
      'body.logicTree[0].children[0].x is not declared (the server answers "property x should not exist")',
      'body.logicTree[0].children[0].y is not declared (the server answers "property y should not exist")',
    ]);
  });
});

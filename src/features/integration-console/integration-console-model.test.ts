import { describe, expect, it } from 'vitest';
import type { ConnectionView, IngestionExceptionDetailView, IngestionJobView, JobAction, JobState } from '@/api/v2/types/integrations';
import { emptyPiForm, formFromConnection, piCreateBody, piFormErrors, piUpdateBody } from './model/connection-form';
import { connectionHealth, diagnosticRows } from './model/diagnostics';
import { sampleQuery } from './model/discovery';
import { bindTargetOf, canReplayAfterDryRun, replayCounts, resolutionReducer } from './model/exception-flow';
import { jobPurpose, presetJobBody } from './model/job-presets';
import { allowedActions, jobHealth } from './model/job-states';
import { changedRules, patchRule, previewBody } from './model/mapping-draft';
import { refusalOf } from './model/refusal';
import { isSourceSupported } from './model/source-types';
import { ux06Stages } from './model/stages';
import { V2ApiError } from '@/api/v2/errors';

const NOW = Date.parse('2026-10-10T08:00:00Z');

const job = (patch: Partial<IngestionJobView> = {}): IngestionJobView => ({
  id: 'j1', connectionId: 'c1', scope: { mode: 'window' }, state: 'running', leaseOwner: 'w1', leaseExpiry: '2026-10-10T08:01:00Z',
  heartbeatAt: '2026-10-10T07:59:30Z', committedCursor: null, lastObservationAt: null, lastSuccessAt: null, retryCount: 0, lastError: null,
  cadence: { intervalSeconds: 60 }, nextRunAt: null, health: {}, rowVersion: 1, createdAt: '2026-10-10T07:00:00Z', updatedAt: null, ...patch,
});

const connection = (patch: Partial<ConnectionView> = {}): ConnectionView => ({
  id: 'c1', sourceType: 'pi_web_api', displayName: 'PI', endpointConfig: { piWebApiUrl: 'https://pi/piwebapi', username: 'reader' }, hasSecret: true, effectiveClientId: null,
  capabilities: {}, configVersion: 2, isActive: true, rowVersion: 4, createdAt: '2026-10-01T00:00:00Z', updatedAt: null, ...patch,
});

describe('job state machine display (ING02)', () => {
  it('offers exactly the commands the server accepts in each state', () => {
    const server: Record<JobAction, JobState[]> = {
      start: ['created', 'stopped', 'failed'],
      pause: ['running', 'draining'],
      resume: ['paused'],
      drain: ['running'],
      stop: ['created', 'running', 'paused', 'draining', 'failed'],
    };
    const states: JobState[] = ['created', 'running', 'paused', 'draining', 'stopped', 'failed'];
    for (const state of states) {
      const expected = (Object.keys(server) as JobAction[]).filter((action) => server[action].includes(state)).sort();
      expect([...allowedActions(state)].sort()).toEqual(expected);
    }
  });

  it('health: failure codes and failed state are errors, retries warn, a lost lease warns, paused is idle', () => {
    expect(jobHealth(job({ state: 'failed', health: { auth_failed: 1 } }), NOW)).toEqual({ tone: 'error', labels: ['Authentication failed'] });
    expect(jobHealth(job({ health: { authz_failed: 1 } }), NOW).labels).toEqual(['Not authorized']);
    expect(jobHealth(job({ retryCount: 3 }), NOW)).toEqual({ tone: 'warning', labels: ['Retrying (3)'] });
    expect(jobHealth(job({ leaseExpiry: '2026-10-10T07:00:00Z' }), NOW).tone).toBe('warning');
    expect(jobHealth(job({ health: { accepted: 12 } }), NOW)).toEqual({ tone: 'ok', labels: ['Healthy'] });
    expect(jobHealth(job({ state: 'paused' }), NOW)).toEqual({ tone: 'idle', labels: ['Paused'] });
  });

  it('presets: backfill days are bounded to 90, purpose is recorded in the scope, every kind starts', () => {
    const scope = { scopeType: 'database' as const, scopeId: 'DB', templateName: 'Production Loss' };
    const backfill = presetJobBody({ purpose: 'backfill', ...scope, days: 400 });
    expect(backfill.scope).toMatchObject({ mode: 'window', lookbackMinutes: 90 * 1440, purpose: 'backfill', templateName: 'Production Loss' });
    expect(backfill.start).toBe(true);
    expect(presetJobBody({ purpose: 'production', ...scope, templateName: null }).scope).not.toHaveProperty('templateName');
    expect(jobPurpose(job({ scope: { purpose: 'limited' } }))).toBe('limited');
    expect(jobPurpose(job({ scope: { purpose: 'nonsense' } }))).toBeNull();
  });
});

describe('connections: write-only secret and staged diagnostics', () => {
  it('never pre-fills or sends an empty secret; credentials never go into endpointConfig', () => {
    const form = formFromConnection(connection());
    expect(form.secret).toBe('');
    expect(piUpdateBody(form, connection())).toBeNull();
    const rotated = piUpdateBody({ ...form, secret: 'new-one' }, connection());
    expect(rotated).toEqual({ secret: 'new-one' });
    const body = piCreateBody({ ...emptyPiForm(), displayName: ' PI sim ', piWebApiUrl: 'http://127.0.0.1:1/piwebapi', secret: 'x' });
    expect(body.endpointConfig).toEqual({ piWebApiUrl: 'http://127.0.0.1:1/piwebapi' });
    expect(JSON.stringify(body.endpointConfig)).not.toContain('x"');
    expect(piCreateBody({ ...emptyPiForm(), displayName: 'a', piWebApiUrl: 'http://h' })).not.toHaveProperty('secret');
    expect(piFormErrors(emptyPiForm())).toEqual({ displayName: expect.any(String), piWebApiUrl: expect.any(String) });
  });

  it('rows follow the PI01 order; auth and authz failures are named apart from unreachable', () => {
    expect(diagnosticRows(null).map((row) => row.status)).toEqual(Array(6).fill('not_run'));
    const failedAuth = { connected: false, message: 'auth check failed', diagnostics: { dns: { status: 'ok' as const }, tls: { status: 'not_applicable' as const }, auth: { status: 'failed' as const, detail: '401' } } };
    expect(connectionHealth(failedAuth)).toBe('auth_failed');
    expect(connectionHealth({ ...failedAuth, diagnostics: { dns: { status: 'failed' as const } } })).toBe('unreachable');
    // plain http: the auth request is the first one, so a refused connection fails there
    const refused = { status: 'failed' as const, detail: 'PI_UNREACHABLE: PI Web API unreachable: ECONNREFUSED' };
    expect(connectionHealth({ ...failedAuth, diagnostics: { ...failedAuth.diagnostics, auth: refused } })).toBe('unreachable');
    expect(connectionHealth({ ...failedAuth, diagnostics: { authz: { status: 'failed' as const } } })).toBe('authz_failed');
    expect(connectionHealth({ connected: true, message: 'All PI Web API checks passed' })).toBe('connected');
  });

  it('PI and MQTT (plan 1.8) are configurable; Kafka is not available yet (D10)', () => {
    expect(isSourceSupported('pi_web_api')).toBe(true);
    expect(isSourceSupported('mqtt')).toBe(true);
    expect(isSourceSupported('kafka')).toBe(false);
  });

  it('refusals: 403 is a role refusal, 412 stale, 502 a source failure with the adapter code', () => {
    const envelope = (code: string) => ({ code, message: code, correlationId: 'c', retryable: false });
    expect(refusalOf(new V2ApiError(403, envelope('FORBIDDEN_ROLE')))?.kind).toBe('role');
    expect(refusalOf(new V2ApiError(403, envelope('READ_ONLY_ROLE')))).toMatchObject({ kind: 'role', title: 'Your role in this plant is read-only' });
    expect(refusalOf(new V2ApiError(412, envelope('STALE_REVISION')))?.kind).toBe('stale');
    expect(refusalOf(new V2ApiError(502, envelope('PI_AUTH_FAILED')))).toMatchObject({ kind: 'source', code: 'PI_AUTH_FAILED' });
    expect(refusalOf(new V2ApiError(422, envelope('ADAPTER_UNAVAILABLE')))?.kind).toBe('unavailable');
  });
});

describe('quarantine resolution flow (ING05)', () => {
  const exception = (patch: Partial<IngestionExceptionDetailView>): IngestionExceptionDetailView => ({
    id: 'e1', connectionId: 'c1', sourceObjectId: 'EF-1', rawId: 'r1', errorCode: 'unknown_unit', detail: null, state: 'open', ownerId: null,
    firstSeen: null, lastSeen: null, occurrences: 1, resolution: null, replayRunId: null, rowVersion: 1, raw: null, ...patch,
  });

  it('binds the recorded source path, else the element id from the payload', () => {
    expect(bindTargetOf(exception({ detail: { sourcePath: '\\\\AF\\HDPE\\U1' } }))).toEqual({ matchKind: 'exact_path', matchValue: '\\\\AF\\HDPE\\U1' });
    const payload = { provenance: { rawPayload: { frame: { PrimaryReferencedElement: { WebId: 'EL-9' } } } } };
    const raw = { id: 'r1', receivedAt: null, messageId: null, outcome: null, payloadVisible: true, payload, payloadRef: null };
    expect(bindTargetOf(exception({ detail: { sourcePath: 'EF-1' }, raw }))).toEqual({ matchKind: 'exact_id', matchValue: 'EL-9' });
    expect(bindTargetOf(exception({}))).toBeNull();
  });

  it('dry run first: a real replay is offered only after a completed dry run that found objects', () => {
    let state = resolutionReducer({ step: 'idle' }, { type: 'dry-run-started', runId: 'r1' });
    expect(state).toEqual({ step: 'dry-run', runId: 'r1' });
    state = resolutionReducer(state, { type: 'replay-started', runId: 'r2' });
    expect(state).toEqual({ step: 'replaying', runId: 'r2' });
    expect(resolutionReducer(state, { type: 'reset' })).toEqual({ step: 'idle' });
    expect(canReplayAfterDryRun({ state: 'running', dryRun: true, counts: { objects: 1 } })).toBe(false);
    expect(canReplayAfterDryRun({ state: 'completed', dryRun: true, counts: { objects: 0 } })).toBe(false);
    expect(canReplayAfterDryRun({ state: 'completed', dryRun: true, counts: { objects: 1 } })).toBe(true);
    expect(canReplayAfterDryRun({ state: 'completed', dryRun: false, counts: { objects: 1 } })).toBe(false);
    expect(replayCounts({ counts: { failed: 0, objects: 2, normalized: 2 } })).toEqual([['objects', 2], ['normalized', 2], ['failed', 0]]);
  });
});

describe('mapping preview draft (ING04, PI02)', () => {
  const effective = [
    { sourceAttr: 'Duration', targetField: 'suppliedDurationSeconds', type: 'duration' as const, unit: 'minutes' as const },
    { sourceAttr: 'Quantity', targetField: 'quantity', type: 'number' as const },
  ];

  it('sends only the changed rules; switching the unit to TimeSpan is one draft rule', () => {
    const draft = patchRule(effective, 'suppliedDurationSeconds', { unit: 'timespan' });
    expect(changedRules(effective, draft)).toEqual([{ ...effective[0], unit: 'timespan' }]);
    expect(changedRules(effective, effective)).toEqual([]);
    expect(patchRule(effective, 'suppliedDurationSeconds', { type: 'number' as never })[0]).not.toHaveProperty('unit');
    const sample = { sourceObjectId: 'EF', name: null, templateName: 'Production Loss', startTime: '2026-10-10T06:00:00.000Z', endTime: null, element: null, attributes: { Duration: '00:15:00' } };
    const body = previewBody({ sample, connectionId: 'c1', templateName: 'Production Loss', draft: changedRules(effective, draft) });
    expect(body).toEqual({ templateName: 'Production Loss', connectionId: 'c1', attributes: { Duration: '00:15:00' }, startTime: sample.startTime, fieldRules: [{ ...effective[0], unit: 'timespan' }] });
  });

  it('sample window is bounded to 31 days and needs a scope', () => {
    expect(sampleQuery({ scopeType: 'database', scopeId: '', templateName: null }, 24, NOW)).toBeNull();
    const query = sampleQuery({ scopeType: 'database', scopeId: 'DB', templateName: 'T' }, 10_000, NOW);
    expect(query).toMatchObject({ scopeId: 'DB', templateName: 'T', limit: 20, to: new Date(NOW).toISOString() });
    expect(Date.parse(query?.to ?? '') - Date.parse(query?.from ?? '')).toBe(31 * 86_400_000);
  });
});

describe('UX06 stage tracker', () => {
  const facts = { connection: connection(), test: null, sampledAt: null, mappingOverrides: 0, sourceMappings: 0, jobs: [], openExceptions: 0 };

  it('a reachable source alone never completes the production stage', () => {
    const stages = ux06Stages({ ...facts, test: { result: { connected: true, message: 'ok' }, at: '2026-10-10T07:00:00Z' } });
    expect(stages.map((stage) => [stage.key, stage.status])).toEqual([
      ['configure', 'done'], ['validate', 'done'], ['discover', 'pending'], ['map', 'pending'],
      ['limited', 'pending'], ['quarantine', 'pending'], ['backfill', 'pending'], ['production', 'pending'],
    ]);
  });

  it('jobs by purpose: created but unread is attention, a committed read is done; open quarantine needs attention', () => {
    const jobs = [job({ scope: { purpose: 'production' } }), job({ id: 'j2', scope: { purpose: 'limited' }, lastSuccessAt: '2026-10-10T07:30:00Z' })];
    const stages = ux06Stages({ ...facts, jobs, openExceptions: 2, sourceMappings: 1 });
    const status = Object.fromEntries(stages.map((stage) => [stage.key, stage.status]));
    expect(status).toMatchObject({ map: 'done', limited: 'done', quarantine: 'attention', production: 'attention', backfill: 'pending' });
  });
});

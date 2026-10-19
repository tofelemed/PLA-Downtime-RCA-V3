import { describe, expect, it } from 'vitest';
import type { ConnectionView } from '@/api/v2/types/integrations';
import { endpointSummary } from '@/features/integration-console/model/endpoint-summary';
import { codeNameLabel } from '@/features/ux-kit/format/code-name';
import { selfApprovalNote } from '@/features/ux-kit/format/self-approval-note';
import { microStopErrors } from './reliability/policy/micro-stop-form-model';
import type { ReliabilityFormat } from './reliability/shared/use-reliability-format';
import { windowFromParams } from './reliability/shared/use-plant-window';
import { STANDBY_CSV_COLUMNS } from './reliability/standby/standby-import-model';
import { standbyEmptyText } from './reliability/standby/standby-empty-text';
import { availabilityText, durationOrNone } from './reliability/unit-state/coverage-facts-text';
import { WORK_ORDER_CSV_COLUMNS } from './reliability/work-orders/work-order-import-model';

const format: ReliabilityFormat = {
  timezone: 'Asia/Tehran',
  dateTime: (iso) => iso ?? '',
  number: (value) => String(value),
  percent: (value, digits) => `${value.toFixed(digits)} %`,
  duration: (seconds) => `${seconds} s`,
};

describe('master data QA round 3 (2026-10-19 re-test)', () => {
  it('N4: the self-approval sentence is for SuperAdmin only', () => {
    expect(selfApprovalNote(false, 'version')).toBe('');
    expect(selfApprovalNote(true, 'version')).toBe(' As SuperAdmin you may approve your own version.');
  });

  it('N7: equal availability bounds read as one value; zero time reads "none"', () => {
    expect(availabilityText({ availabilityLower: 0.946, availabilityUpper: 0.946 }, format)).toEqual({ text: '94.6 %', bounded: false });
    expect(availabilityText({ availabilityLower: 0.5, availabilityUpper: 0.9 }, format)).toEqual({ text: 'between 50.0 % and 90.0 %', bounded: true });
    expect(durationOrNone(0, format)).toBe('none');
    expect(durationOrNone(60, format)).toBe('60 s');
  });

  it('N8: import help names the columns in plain words, never the internal field names', () => {
    for (const columns of [WORK_ORDER_CSV_COLUMNS, STANDBY_CSV_COLUMNS]) expect(columns).not.toMatch(/[a-z][A-Z]|_/);
  });

  it('L2: one label for a record with a code', () => {
    expect(codeNameLabel({ code: 'Extruder1', name: 'HDPE Extruder 1' })).toBe('Extruder1 — HDPE Extruder 1');
    expect(codeNameLabel({ code: 'X', name: 'X' })).toBe('X');
  });

  it('L10: an empty threshold gets its own inline message', () => {
    expect(microStopErrors({ microStopSeconds: '', classes: [], tripCodes: '', notes: '' }).microStopSeconds).toBe('Enter the threshold in whole seconds (0 to 86400)');
    expect(microStopErrors({ microStopSeconds: '-5', classes: [], tripCodes: '', notes: '' }).microStopSeconds).toBe('Whole seconds from 0 to 86400');
  });

  it('L11: the coverage window is read from the address when it is an ordered pair of instants', () => {
    expect(windowFromParams(new URLSearchParams('unitId=u&from=2026-10-17T02:30:00.000Z&to=2026-10-18T02:30:00.000Z'))).toEqual({ from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z' });
    expect(windowFromParams(new URLSearchParams('from=2026-10-18T00:00:00Z&to=2026-10-17T00:00:00Z'))).toBeNull();
    expect(windowFromParams(new URLSearchParams('unitId=u'))).toBeNull();
  });

  it('L13: no invitation to register for a user who cannot register', () => {
    expect(standbyEmptyText(false)).not.toMatch(/^Register/);
    expect(standbyEmptyText(true)).toMatch(/^Register/);
  });

  it('L24: the derived MQTT client id is not shown; a client id the plant set is', () => {
    const connection = (clientId?: string): ConnectionView => ({
      id: 'c1', sourceType: 'mqtt', displayName: 'Broker', hasSecret: false, effectiveClientId: clientId ?? 'proact-466d5564-054c-4b56-8550-0c1fcd7f337d',
      endpointConfig: { mqtt: { brokerUrl: 'mqtt://broker:1883', protocolVersion: 5, topics: ['a/#'], ...(clientId ? { clientId } : {}) } },
      capabilities: {} as ConnectionView['capabilities'], configVersion: 1, isActive: true, rowVersion: 1, createdAt: null, updatedAt: null,
    });
    expect(endpointSummary(connection())).not.toMatch(/client id/);
    expect(endpointSummary(connection('plant-gw-1'))).toMatch(/client id plant-gw-1/);
  });
});

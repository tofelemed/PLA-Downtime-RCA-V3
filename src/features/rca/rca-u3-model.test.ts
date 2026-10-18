import { describe, expect, it } from 'vitest';
import type { RcaLinkView } from '@/api/v2/types/rca';
import { diagramText } from './case/analysis/tools/event-diagram/diagram-model';
import { actionFiltersFromParams, paramsFromActionFilters, toActionQuery, DEFAULT_ACTION_FILTERS } from './model/action-queue-filters';
import { EMPTY_CASE_FILTERS, filtersFromParams, filtersOfChip, isChipActive, paramsFromFilters, toCaseQuery } from './model/case-filters';
import { EMPTY_EVIDENCE_FORM, evidenceFormOf, evidenceItemOf, verifiedText } from './model/evidence-form';
import { defaultPickerWindow, hasWindow, pickerWindow, triggerOfLinks } from './model/link-picker';
import { addCalendarDays } from '@/lib/dates';
import { actionProgressText } from './model/rca-labels';

const UTC = 'UTC';

describe('actions tab filters (F-7)', () => {
  it('defaults to my actions and keeps only changed filters in the URL', () => {
    expect(actionFiltersFromParams(new URLSearchParams('tab=actions'))).toEqual(DEFAULT_ACTION_FILTERS);
    expect(paramsFromActionFilters(DEFAULT_ACTION_FILTERS)).toEqual({ tab: 'actions' });
    const filters = actionFiltersFromParams(new URLSearchParams('tab=actions&mine=false&overdue=true&status=in_progress&unitId=u-1'));
    expect(filters).toEqual({ mine: false, overdue: true, status: 'in_progress', unitId: 'u-1' });
    expect(paramsFromActionFilters(filters)).toEqual({ tab: 'actions', mine: 'false', overdue: 'true', status: 'in_progress', unitId: 'u-1' });
  });

  it('maps the filters to the server query and ignores an unknown status', () => {
    expect(toActionQuery(DEFAULT_ACTION_FILTERS)).toEqual({ mine: true, overdue: undefined, status: undefined, unitId: undefined });
    expect(toActionQuery({ mine: false, overdue: true, status: 'done', unitId: 'u-2' })).toEqual({ mine: undefined, overdue: true, status: ['done'], unitId: 'u-2' });
    expect(actionFiltersFromParams(new URLSearchParams('status=bogus')).status).toBe('all');
  });
});

describe('case list (U3)', () => {
  it('"Open critical" filters open and critical, exactly as counted', () => {
    const critical = filtersOfChip({ kind: 'critical' });
    expect(critical).toEqual({ ...EMPTY_CASE_FILTERS, priority: 'Critical', open: 'true' });
    expect(toCaseQuery(critical)).toMatchObject({ priority: 'Critical', open: true });
    expect(isChipActive({ kind: 'critical' }, { ...EMPTY_CASE_FILTERS, priority: 'Critical' })).toBe(false);
    expect(isChipActive({ kind: 'critical' }, critical)).toBe(true);
  });

  it('keeps open / closed in the URL', () => {
    expect(filtersFromParams(new URLSearchParams('open=false')).open).toBe('false');
    expect(filtersFromParams(new URLSearchParams('open=maybe')).open).toBe('all');
    expect(paramsFromFilters({ ...EMPTY_CASE_FILTERS, open: 'true' })).toEqual({ open: 'true' });
    expect(toCaseQuery({ ...EMPTY_CASE_FILTERS, open: 'false' }).open).toBe(false);
    expect(toCaseQuery(EMPTY_CASE_FILTERS).open).toBeUndefined();
  });

  it('writes action progress as done/total with the overdue count', () => {
    expect(actionProgressText({ total: 5, done: 3, overdue: 1 })).toBe('3/5 done · 1 overdue');
    expect(actionProgressText({ total: 2, done: 2, overdue: 0 })).toBe('2/2 done');
  });
});

describe('evidence task assignee and verification (U3)', () => {
  const base = { id: 'ev-1', collectedAt: null, collectedBy: null, nodeIds: [], verifiedBy: 'u-9', verifiedAt: '2026-10-02T08:00:00Z' };

  it('round-trips the assignee and only sends the declared fields', () => {
    const item = evidenceItemOf({ ...EMPTY_EVIDENCE_FORM, title: 'Photo', taskAssigneeId: 'u-2' }, { ...base, extra: 'x' } as typeof base);
    expect(item.taskAssigneeId).toBe('u-2');
    expect(item).not.toHaveProperty('extra');
    expect(item.verifiedBy).toBe('u-9');
    expect(evidenceFormOf(item, UTC).taskAssigneeId).toBe('u-2');
    expect(evidenceItemOf({ ...EMPTY_EVIDENCE_FORM, title: 'x' }, base).taskAssigneeId).toBeNull();
  });

  it('names who verified and when, when the server recorded it', () => {
    const nameOf = (id: string) => (id === 'u-9' ? 'Sara Karimi' : 'Unknown user');
    const at = (iso: string) => `at:${iso}`;
    expect(verifiedText({ verified: true, verifiedBy: 'u-9', verifiedAt: 'T' }, nameOf, at)).toBe('Verified by Sara Karimi at at:T');
    expect(verifiedText({ verified: true, verifiedBy: null, verifiedAt: null }, nameOf, at)).toBe('Yes');
    expect(verifiedText({ verified: false, verifiedBy: 'u-9', verifiedAt: 'T' }, nameOf, at)).toBe('No');
  });
});

describe('link pickers (U3)', () => {
  const eventLink = (linkedAt: string, start: string): RcaLinkView => ({
    id: linkedAt, rcaId: 'c1', linkType: 'event', targetId: `e-${linkedAt}`, targetRevision: null, unitId: 'u-1', source: 'manual',
    linkedBy: null, linkedAt, reason: null, evidence: { event: { start, unitId: 'u-1' } },
  });

  it('takes the first linked event as the trigger', () => {
    const links = [eventLink('2026-10-05T00:00:00Z', '2026-10-04T06:00:00Z'), eventLink('2026-10-01T00:00:00Z', '2026-09-30T06:00:00Z')];
    expect(triggerOfLinks(links)).toEqual({ start: '2026-09-30T06:00:00Z', unitId: 'u-1' });
    expect(triggerOfLinks([])).toBeNull();
  });

  it('defaults to 30 days around the trigger, else the last 30 days', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    expect(defaultPickerWindow('2026-09-30T06:00:00Z', now, UTC)).toEqual({ fromDay: '2026-09-15', toDay: '2026-10-15' });
    expect(defaultPickerWindow(null, now, UTC)).toEqual({ fromDay: '2026-09-19', toDay: '2026-10-18' });
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('sends the chosen days as a half-open window in the plant zone', () => {
    expect(pickerWindow({ fromDay: '2026-10-01', toDay: '2026-10-02' }, 'Asia/Tehran')).toEqual({ from: '2026-09-30T20:30:00.000Z', to: '2026-10-02T20:30:00.000Z' });
    expect(hasWindow({ fromDay: '2026-10-03', toDay: '2026-10-02' })).toBe(false);
    expect(hasWindow({ fromDay: '', toDay: '2026-10-02' })).toBe(false);
  });
});

describe('event diagram text (F-6)', () => {
  it('keeps events and connections in words', () => {
    const node = (id: string, label: string) => ({ id, label, type: 'Alarm', timestamp: null, description: id === 'n1' ? 'High vibration' : null, asset: null, severity: null, position: { x: 0, y: 0 } });
    const text = diagramText({ nodes: [node('n1', 'Alarm'), node('n2', 'Trip')], edges: [{ id: 'e', source: 'n1', target: 'n2' }] });
    expect(text).toBe('Event: Alarm (Alarm) — High vibration\nEvent: Trip (Alarm)\nConnection: Alarm → Trip');
  });
});

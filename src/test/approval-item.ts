import type { ApprovalItem } from '@/api/v2/types/approvals';

/** A pending inbox row for component tests (a profile version a manager approver may decide). */
export function approvalItem(extra: Partial<ApprovalItem> = {}): ApprovalItem {
  return {
    id: 'profile-1', kind: 'profile', kindLabel: 'Production profile', title: 'Extruder HDPE', summary: 'HDPE-BL3 · t/h', state: 'draft',
    createdAt: '2026-10-01T00:00:00.000000Z', unitId: 'unit-1', unitName: 'EX-01', authorId: 'author', authorName: 'Engineer A',
    requiredRoles: ['manager_approver'], reviewHref: '/planning/profiles/profile-1#profile-version', resource: 'profiles', commandId: 'profile-1',
    version: 1, rowVersion: 3, supersede: true, actions: [{ action: 'approve', disabledReason: null }, { action: 'retire', disabledReason: null }],
    canDecide: true, decisionBlockedReason: null, headline: null,
    target: { periodId: null, planId: null, revision: null, monthKey: null, eventId: null, profileId: 'profile-1' },
    ...extra,
  };
}

import type { MonthCloseView } from '@/api/v2/types/month-close';

/** Isolated component-test data; never sent to a running backend. */
export function monthCloseFixture(): MonthCloseView {
  return {
    monthKey: '1405-07', calendar: 'persian', firstDate: '2026-09-23', endDate: '2026-10-23', lastDate: '2026-10-22',
    previousMonthKey: '1405-06', nextMonthKey: '1405-08', state: 'open', rowVersion: null,
    policy: { id: 'policy', version: 2, quantitiesCloseWorkingDay: 3, financeSignOffWorkingDay: 5,
      weekendDays: [4, 5], blockOnOpenProposals: true, requireCertifiedDays: true,
      materialityEnabled: false, materialityReviewerRoles: ['production_accountant'] },
    deadlines: { timezone: 'Asia/Tehran', quantitiesDue: '2026-10-26', quantitiesDueAt: '2026-10-26T20:30:00Z',
      financeDue: '2026-10-28', financeDueAt: '2026-10-28T20:30:00Z', quantitiesOverdue: false,
      financeOverdue: false, holidays: [] },
    signOffs: { quantitiesClosedBy: null, quantitiesClosedAt: null, materialityRequired: false,
      materialityReviewedBy: null, materialityReviewedAt: null, financeSignedOffBy: null, financeSignedOffAt: null,
      lockedBy: null, lockedAt: null },
    prerequisites: { met: true, periods: 90, approved: 90, pendingCount: 0, pending: [],
      missingPeriodCount: 0, missingPeriods: [], monthEnded: true, monthEndsAt: '2026-10-31T20:30:00Z',
      days: 30, certifiedDays: 30, uncertifiedDays: [], openProposalCount: 0, openProposals: [] },
    materiality: { findings: [], adjustmentTotals: [] }, reopenCount: 0, comment: null, history: [], asOf: '2026-10-25T08:00:00Z',
  };
}

export function cappedMonthCloseFixture(): MonthCloseView {
  const view = monthCloseFixture();
  view.prerequisites = {
    met: false, periods: 90, approved: 20, pendingCount: 70,
    missingPeriodCount: 0, missingPeriods: [], monthEnded: true, monthEndsAt: '2026-10-31T20:30:00Z',
    pending: Array.from({ length: 50 }, (_, index) => ({
      periodId: `period-${index}`, unitId: 'unit100', unitName: 'Unit 100', localDate: '2026-10-20', shiftName: 'A', workflow: 'in_review',
    })),
    days: 80, certifiedDays: 20,
    uncertifiedDays: Array.from({ length: 50 }, (_, index) => ({ unitId: `unit-${index}`, unitName: `Unit ${index}`, localDate: '2026-10-20' })),
    openProposalCount: 56,
    openProposals: Array.from({ length: 50 }, (_, index) => ({
      proposalId: `proposal-${index}`, periodId: `period-${index}`, unitId: 'unit100', localDate: '2026-10-20',
      trigger: 'manual_correction', planId: index === 0 ? 'plan-a' : null,
      manualReason: `Late evidence ${index}`, createdAt: '2026-10-25T08:00:00Z',
    })),
  };
  return view;
}

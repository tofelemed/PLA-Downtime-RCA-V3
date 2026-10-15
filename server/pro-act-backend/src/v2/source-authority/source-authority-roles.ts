/**
 * D05 / SME E7 source authority. The integration owner or production accounting drafts a version; the
 * reconciliation owner (production accounting) approves it, never its author (owner, 15 Oct 2026: master
 * data that changes financial figures is maker-checker).
 */
export const SOURCE_AUTHORITY_WRITERS = [
  'integration_admin',
  'production_accountant',
] as const;

export const SOURCE_AUTHORITY_APPROVERS = ['production_accountant'] as const;

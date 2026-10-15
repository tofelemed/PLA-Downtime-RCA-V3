/**
 * Roles of the month close (SME R1 / R4, phase R-B; engineering default to confirm, DECISIONS.md
 * 2026-10-15): plant management (`manager_approver`) closes the quantities, finance (`finance_approver`)
 * signs off and locks — never the same person; the materiality review is open to the reviewer roles of
 * the `month_close` policy (default production accounting), checked again in the service. Reopening a
 * closing month belongs to either signer. Reads: any tenant member.
 */
export const QUANTITY_CLOSERS = ['manager_approver'] as const;

export const FINANCE_SIGNERS = ['finance_approver'] as const;

export const MATERIALITY_REVIEWERS = [
  'production_accountant',
  'manager_approver',
  'finance_approver',
] as const;

export const MONTH_REOPENERS = [
  'manager_approver',
  'finance_approver',
] as const;

/** SME R5: finance decides how a restatement is posted (posting date, treatment). */
export const POSTING_DECIDERS = ['finance_approver'] as const;

/**
 * SME R13: source status mappings are drafted by integration admins or production accounting and approved
 * by the source owner — production accounting for production reports (engineering default) — never the
 * author.
 */
export const STATUS_MAPPING_AUTHORS = [
  'integration_admin',
  'production_accountant',
] as const;

export const SOURCE_OWNERS = ['production_accountant'] as const;

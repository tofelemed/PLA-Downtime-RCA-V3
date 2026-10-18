import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';

export type RcaRepeatMatch = 'asset' | 'asset_and_mode' | 'asset_mode_and_mechanism';
export type RcaCostCurrency = 'IRR' | 'USD';

/** The workflow rule sections of the policy (SME CA2–CA7). */
export interface RcaPolicyRules {
  effectiveness: {
    baselineLookbackDays: number;
    minExposureHours: number;
    requiredReduction: number;
    reviewDays: number;
    zeroRepeatClasses: string[];
    /** 0–1: state-data coverage the window after an action needs for a verdict (server default 0.95) */
    minimumCoverage?: number;
  };
  fmea: {
    method: 'rpn' | 'action_priority';
    rpnThreshold: number;
    severityReview: number;
    priorityRules: Array<{ priority: string; severityMin: number; occurrenceMin: number; detectionMin: number }>;
  };
  fiveWhy: { guidelineLevels: number; minLevels: number; evidencePerLevel: boolean; unsupportedRootCauses: string[] };
  investigation: Record<string, { methodGroups: string[][]; minTeamMembers: number }>;
}

/**
 * One `rca_policy` version (backend `RcaPolicyVersionV2View`; D13, SME D17 / CA2–CA8): tenant-wide when
 * `unitId` is null. The whole parsed body: the any-of triggers and the workflow rules.
 */
export interface RcaPolicyVersion extends RcaPolicyRules {
  id: string;
  unitId: string | null;
  version: number;
  durationThresholdSeconds: number;
  costThreshold: number | null;
  costCurrency: RcaCostCurrency | null;
  lostQuantityShareOfDailyPlan: number | null;
  repeatCount: number;
  repeatWindowDays: number;
  repeatMatch: RcaRepeatMatch;
  criticalAssets: { criticalities: string[]; thresholdFactor: number };
  cumulative: { windowDays: number; downtimeSeconds: number } | null;
  consequence: { solTypes: string[]; severities: string[] };
  autoCreate: 'recommend' | 'create';
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  rowVersion: number;
}

export interface RcaPolicyInput {
  unitId: string | null;
  durationThresholdSeconds: number;
  repeatCount: number;
  repeatWindowDays: number;
  autoCreate: 'recommend' | 'create';
  costThreshold: number | null;
  costCurrency: RcaCostCurrency | null;
  lostQuantityShareOfDailyPlan: number | null;
  repeatMatch: RcaRepeatMatch;
  criticalAssets: { criticalities: string[]; thresholdFactor: number };
  cumulative: { windowDays: number; downtimeSeconds: number } | null;
  notes?: string;
  /** the workflow rules (SME CA2–CA7); the server parser validates them (422 INVALID_POLICY) */
  effectiveness?: RcaPolicyRules['effectiveness'];
  fmea?: RcaPolicyRules['fmea'];
  fiveWhy?: RcaPolicyRules['fiveWhy'];
  investigation?: RcaPolicyRules['investigation'];
}

/**
 * Policy reads are cached under the RCA recommendation resource: a new policy version changes which
 * recommendations fire, and every `rca_recommendation` notice refreshes both.
 */
const RESOURCE = 'rca-recommendations' as const;
const scopeQuery = (unitId: string | null) => (unitId ? { unitId } : {});

/** The version in force now for the scope (the server seeds the SME D17 pilot on first read). */
export function useCurrentRcaPolicy(unitId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', RESOURCE, { filters: { policy: 'current', unitId } }),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    queryFn: async ({ signal }) =>
      (await v2Request<RcaPolicyVersion>({ method: 'GET', path: '/rca-policies/current', query: scopeQuery(unitId), signal })).data,
  });
}

/** Versions of the scope, newest first, 20 per page. */
export function useRcaPolicyVersions(unitId: string | null) {
  return usePagedQuery<RcaPolicyVersion>({
    resource: RESOURCE,
    path: '/rca-policies',
    query: scopeQuery(unitId),
    key: { filters: { policy: 'versions', unitId } },
  });
}

/** A new version, in force from now (manager approver; tenant-wide needs a tenant-wide grant). */
export function useCreateRcaPolicy() {
  const tenantId = useV2TenantId();
  return useV2Command<RcaPolicyInput, RcaPolicyVersion>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<RcaPolicyVersion>({ method: 'POST', path: '/rca-policies', body: input, idempotencyKey })).data,
    retries: 0,
    changes: () => (tenantId ? { tenantId, entityType: 'rca_recommendation' } : null),
  });
}

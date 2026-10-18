import type { FieldVocabulary } from '@/features/ux-kit/errors';
import {
  DEFAULT_BASIS_LABELS,
  DEMAND_RULE_LABELS,
  FX_DATE_RULE_LABELS,
  FX_POLICY_LABELS,
  FX_RATE_TYPE_LABELS,
  QUALITY_DISPOSITION_LABELS,
  TIME_BASIS_RULE_LABELS,
} from '@/features/ux-kit/labels';

/**
 * The valuation policy form's words for the server fields of `POST /v2/valuation-policies` (owner manual
 * test: a refusal must say "Default management view", not "Default basis", and name the choices as the form
 * lists them). Keep in step with the labels in `policy-form.tsx` / `economic-fields.tsx`.
 */
export const POLICY_FIELD_VOCABULARY: FieldVocabulary = {
  defaultBasis: { label: 'Default management view', values: DEFAULT_BASIS_LABELS },
  timeBasisRule: { label: 'Time-based costs', values: TIME_BASIS_RULE_LABELS },
  fxPolicy: { label: 'Currency conversion', values: FX_POLICY_LABELS },
  effectiveFrom: { label: 'Starts' },
  backdateReason: { label: 'Reason for backdating' },
  restateApproved: { label: 'Restate approved figures in this range' },
  reportingCurrencies: { label: 'Reporting currencies' },
  independentImpactCodeIds: { label: 'Independent impact codes' },
  notes: { label: 'Notes' },
  fxRateType: { label: 'Exchange-rate table', values: FX_RATE_TYPE_LABELS },
  fxDateRule: { label: 'Rate date', values: FX_DATE_RULE_LABELS },
  fxAverageMaxDeviation: { label: 'Refuse the average beyond (ratio)' },
  demandRule: { label: 'Lost sales', values: DEMAND_RULE_LABELS },
  defaultQualityDisposition: { label: 'Quality losses without a mapped code', values: QUALITY_DISPOSITION_LABELS },
  qualityDispositions: { label: 'Quality loss dispositions', values: QUALITY_DISPOSITION_LABELS },
  manualLineHours: { label: 'Hourly cost for manual downtime lines' },
};

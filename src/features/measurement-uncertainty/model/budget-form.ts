import type { UncertaintyBudgetCreateBody, UncertaintyPreviewBody } from '@/api/v2/types/uncertainty';

export const COMPONENT_KINDS = ['meter', 'scale', 'inventory', 'conversion', 'timing'] as const;

export const COMPONENT_KIND_LABELS: Readonly<Record<string, string>> = {
  meter: 'Meter / totalizer',
  scale: 'Scale',
  inventory: 'Inventory (silo, tank)',
  conversion: 'Conversion (density, moisture)',
  timing: 'Timing (cut-off)',
};

export interface ComponentRow {
  kind: (typeof COMPONENT_KINDS)[number];
  label: string;
  standardUncertainty: string | null;
  /** sensitivity coefficient; null = 1 (server default) */
  sensitivity: string | null;
}

export interface CorrelationRow {
  a: number;
  b: number;
  coefficient: string | null;
}

/** What the user enters on "New uncertainty budget"; instants are UTC from the date-time inputs. */
export interface BudgetFormValues {
  boundary: string;
  uom: string;
  components: ComponentRow[];
  correlations: CorrelationRow[];
  coverageFactor: string | null;
  calibrationRef: string;
  reviewDueAt: string | null;
  effectiveFrom: string | null;
  evidenceRef: string;
  notes: string;
}

export type BudgetErrors = Partial<Record<keyof BudgetFormValues, string>>;

export const emptyComponent = (kind: ComponentRow['kind'] = 'meter'): ComponentRow => ({ kind, label: '', standardUncertainty: null, sensitivity: null });

/** SME E4 default: two readings (added and subtracted), coverage factor 2, effective now. */
export const emptyBudget = (now: string): BudgetFormValues => ({
  boundary: '',
  uom: 't',
  components: [emptyComponent('meter'), { ...emptyComponent('scale'), sensitivity: '-1' }],
  correlations: [],
  coverageFactor: '2',
  calibrationRef: '',
  reviewDueAt: null,
  effectiveFrom: now,
  evidenceRef: '',
  notes: '',
});

const BOUNDARY = /^[A-Za-z0-9_.-]{1,64}$/;

/** Request-shape checks; the maths and their consistency (|r| ≤ 1, variance ≥ 0) are the server's (422). */
export function validateBudget(values: BudgetFormValues): BudgetErrors {
  const errors: BudgetErrors = {};
  if (!BOUNDARY.test(values.boundary.trim())) errors.boundary = 'Name the boundary (letters, digits, _ . -)';
  if (!values.uom.trim()) errors.uom = 'Enter the unit';
  if (values.components.length === 0 || values.components.some((c) => !c.label.trim() || c.standardUncertainty === null)) {
    errors.components = 'Every component needs a name and a standard uncertainty';
  }
  if (values.correlations.some((r) => r.a === r.b || r.coefficient === null)) errors.correlations = 'A correlation links two different components with a coefficient';
  if (!values.calibrationRef.trim()) errors.calibrationRef = 'Enter the calibration evidence';
  if (!values.effectiveFrom) errors.effectiveFrom = 'Enter when the budget takes effect';
  if (!values.reviewDueAt) errors.reviewDueAt = 'Enter the next review date';
  return errors;
}

const text = (value: string) => value.trim() || undefined;

/** The maths part as the server's preview takes it (exactly the declared fields). */
export function previewBody(values: BudgetFormValues): UncertaintyPreviewBody {
  return {
    components: values.components.map((c) => ({
      kind: c.kind,
      label: c.label.trim() || c.kind,
      standardUncertainty: c.standardUncertainty ?? '0',
      ...(c.sensitivity !== null ? { sensitivity: c.sensitivity } : {}),
    })),
    ...(values.correlations.length > 0 ? { correlations: values.correlations.map((r) => ({ a: r.a, b: r.b, coefficient: r.coefficient ?? '0' })) } : {}),
    ...(values.coverageFactor !== null ? { coverageFactor: values.coverageFactor } : {}),
  };
}

/** The proposal body: exactly the declared fields (the server refuses others). */
export function budgetBody(values: BudgetFormValues, unitId: string): UncertaintyBudgetCreateBody {
  const optional = { evidenceRef: text(values.evidenceRef), notes: text(values.notes) };
  return {
    ...previewBody(values),
    unitId,
    boundary: values.boundary.trim(),
    uom: values.uom.trim(),
    calibrationRef: values.calibrationRef.trim(),
    effectiveFrom: values.effectiveFrom as string,
    reviewDueAt: values.reviewDueAt as string,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
  };
}

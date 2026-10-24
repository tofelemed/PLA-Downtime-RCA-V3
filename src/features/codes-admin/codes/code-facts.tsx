import { Fragment } from 'react';
import { useCodeList } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { LIBRARIES } from '../model/code-fields';

interface Fact {
  label: string;
  value: string;
}

const orDash = (value: string | null | undefined) => (value && value.trim() !== '' ? value : '—');

/** The impact code a reason code defaults to, by code and name (its id never shows). */
function useImpactLabel(id: string | null | undefined): string {
  const impacts = useCodeList('impact-codes', {});
  if (!id) return '—';
  const impact = impacts.items.find((entry) => entry.id === id);
  return impact ? `${impact.code} — ${impact.name}` : '—';
}

function factsOf(library: CodeLibraryPath, code: CodeDetailView, money: boolean, impact: string): Fact[] {
  const fields = LIBRARIES[library].fields;
  const defaults = code.defaults;
  return [
    { label: 'Name', value: code.name },
    { label: 'Description', value: orDash(code.description) },
    ...(fields.includes('category') ? [{ label: 'Category', value: orDash(code.category) }] : []),
    ...(fields.includes('defaults')
      ? [
          { label: 'Default OEE component', value: defaults?.oeeComponent ? (OEE_COMPONENT_LABELS[defaults.oeeComponent] ?? defaults.oeeComponent) : '—' },
          { label: 'Default schedule class', value: defaults?.scheduleClass ? (SCHEDULE_CLASS_LABELS[defaults.scheduleClass] ?? defaults.scheduleClass) : '—' },
          { label: 'Default impact code', value: impact },
        ]
      : []),
    ...(fields.includes('costPerHour') && money ? [{ label: 'Cost per hour (plant currency)', value: orDash(code.costPerHour) }] : []),
    ...(fields.includes('reportOrder') ? [{ label: 'Order in reports', value: String(code.reportOrder ?? 0) }] : []),
  ];
}

/** A code's fields as text for users who cannot change it (a reader, or a retired code). */
export function CodeFacts({ library, code }: { library: CodeLibraryPath; code: CodeDetailView }) {
  const { canViewMoney } = useCapabilities();
  const impact = useImpactLabel(code.defaults?.impactCodeId);
  return (
    <dl className="grid max-w-3xl gap-x-4 gap-y-1 rounded-lg border bg-card p-4 text-sm sm:grid-cols-[14rem_1fr]" data-testid="code-facts">
      {factsOf(library, code, canViewMoney, impact).map((fact) => (
        <Fragment key={fact.label}>
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="mb-1 sm:mb-0">{fact.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

import { useCode } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath } from '@/api/v2/types/codes-admin';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FactsList, type Fact } from '@/features/master-data/rca/facts-list';
import { OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { LIBRARIES } from '../model/code-fields';

const orDash = (value: string | null | undefined) => (value && value.trim() !== '' ? value : '—');
const labelOr = (labels: Readonly<Record<string, string>>, value: string | null | undefined) => (value ? (labels[value] ?? value) : '—');

/** The impact code a reason code defaults to, fetched by its id, shown by code and name (never the id). */
function useImpactLabel(id: string | null | undefined): string {
  const impact = useCode('impact-codes', id ?? null);
  if (!id) return '—';
  return impact.data ? `${impact.data.code} — ${impact.data.name}` : '…';
}

function defaultFacts(code: CodeDetailView, impact: string): Fact[] {
  return [
    { label: 'Default OEE component', value: labelOr(OEE_COMPONENT_LABELS, code.defaults?.oeeComponent) },
    { label: 'Default schedule class', value: labelOr(SCHEDULE_CLASS_LABELS, code.defaults?.scheduleClass) },
    { label: 'Default impact code', value: impact },
  ];
}

interface FactInput {
  library: CodeLibraryPath;
  code: CodeDetailView;
  money: boolean;
  impact: string;
  number: (value: number, fractionDigits?: number) => string;
}

function factsOf({ library, code, money, impact, number }: FactInput): Fact[] {
  const fields = LIBRARIES[library].fields;
  const cost = code.costPerHour ? number(Number(code.costPerHour), 2) : '—';
  return [
    { label: 'Name', value: code.name },
    { label: 'Description', value: orDash(code.description) },
    ...(fields.includes('category') ? [{ label: 'Category', value: orDash(code.category) }] : []),
    ...(fields.includes('defaults') ? defaultFacts(code, impact) : []),
    ...(fields.includes('costPerHour') && money ? [{ label: 'Cost per hour (plant currency)', value: cost }] : []),
    ...(fields.includes('reportOrder') ? [{ label: 'Order in reports', value: number(code.reportOrder ?? 0) }] : []),
  ];
}

/** A code's fields as text for users who cannot change it (a reader, or a retired code). */
export function CodeFacts({ library, code }: { library: CodeLibraryPath; code: CodeDetailView }) {
  const { canViewMoney } = useCapabilities();
  const { number } = useNumberFormat();
  const impact = useImpactLabel(code.defaults?.impactCodeId);
  return <FactsList testId="code-facts" facts={factsOf({ library, code, money: canViewMoney, impact, number })} />;
}

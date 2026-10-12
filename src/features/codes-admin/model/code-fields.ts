import type { CodeChangeBody, CodeCreateBody } from '@/api/v2/queries/codes-admin';
import type { CodeDetailView, CodeLibraryPath, FailureGroupKind } from '@/api/v2/types/codes-admin';

type OeeComponent = NonNullable<CodeCreateBody['defaultOeeComponent']>;
type ScheduleClass = NonNullable<CodeCreateBody['defaultScheduleClass']>;

/** Enum values of the API (typed against the generated OpenAPI body, so a drift fails the build). */
export const OEE_COMPONENTS: readonly OeeComponent[] = ['availability', 'performance', 'quality', 'idle', 'none'];
export const SCHEDULE_CLASSES: readonly ScheduleClass[] = ['planned', 'unplanned', 'external', 'unknown'];
export const FAILURE_KINDS: readonly FailureGroupKind[] = ['class', 'problem', 'cause', 'remedy'];

export interface LibrarySpec {
  path: CodeLibraryPath;
  label: string;
  hierarchical: boolean;
  /** fields the editor shows besides name and description */
  fields: ReadonlyArray<'category' | 'defaults' | 'costPerHour' | 'reportOrder'>;
}

export const LIBRARIES: Readonly<Record<CodeLibraryPath, LibrarySpec>> = {
  'reason-codes': { path: 'reason-codes', label: 'Reason codes', hierarchical: true, fields: ['category', 'defaults'] },
  'impact-codes': { path: 'impact-codes', label: 'Impact codes', hierarchical: false, fields: ['category', 'costPerHour'] },
  'oee-codes': { path: 'oee-codes', label: 'OEE codes', hierarchical: false, fields: ['category'] },
  'failure-code-groups': { path: 'failure-code-groups', label: 'Failure code groups', hierarchical: true, fields: [] },
  'loss-category-defs': { path: 'loss-category-defs', label: 'Loss categories', hierarchical: true, fields: ['reportOrder'] },
};

/** Library order of the picker (reason codes first: the library most plants edit). */
export const LIBRARY_PATHS: readonly CodeLibraryPath[] = ['reason-codes', 'impact-codes', 'oee-codes', 'failure-code-groups', 'loss-category-defs'];

/** Whether a route or URL value names a library. */
export const isCodeLibrary = (value: string | undefined): value is CodeLibraryPath =>
  value !== undefined && (LIBRARY_PATHS as readonly string[]).includes(value);

/** "Reason code" from "Reason codes" (dialog titles, buttons). */
export const singularLabel = (library: CodeLibraryPath): string => LIBRARIES[library].label.replace(/ies$/, 'y').replace(/s$/, '');

/** Editable values of a code as form text. */
export interface CodeForm {
  name: string;
  description: string;
  category: string;
  oeeComponent: string;
  scheduleClass: string;
  impactCodeId: string;
  costPerHour: string | null;
  reportOrder: string;
}

export function formOf(code: CodeDetailView): CodeForm {
  return {
    name: code.name,
    description: code.description ?? '',
    category: code.category ?? '',
    oeeComponent: code.defaults?.oeeComponent ?? '',
    scheduleClass: code.defaults?.scheduleClass ?? '',
    impactCodeId: code.defaults?.impactCodeId ?? '',
    costPerHour: code.costPerHour ?? null,
    reportOrder: String(code.reportOrder ?? 0),
  };
}

const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

/** Body of the next version: only the fields the library has (others would be 422 FIELD_NOT_ALLOWED). */
export function changeBodyOf(spec: LibrarySpec, form: CodeForm): CodeChangeBody {
  const body: CodeChangeBody = { name: form.name.trim(), description: orNull(form.description) };
  if (spec.fields.includes('category')) body.category = orNull(form.category);
  if (spec.fields.includes('defaults')) {
    body.defaultOeeComponent = (orNull(form.oeeComponent) as OeeComponent | null) ?? null;
    body.defaultScheduleClass = (orNull(form.scheduleClass) as ScheduleClass | null) ?? null;
    body.defaultImpactCodeId = orNull(form.impactCodeId);
  }
  if (spec.fields.includes('costPerHour')) body.costPerHour = form.costPerHour;
  if (spec.fields.includes('reportOrder')) body.reportOrder = Number(form.reportOrder) || 0;
  return body;
}

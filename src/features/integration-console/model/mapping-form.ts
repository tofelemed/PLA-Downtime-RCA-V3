import type { SourceMappingBody } from '@/api/v2/queries/integration-mappings';
import type { MappingTargetType, MatchKind, SourceMappingView } from '@/api/v2/types/integration-mappings';
import type { SourceType } from '@/api/v2/types/integrations';

/** `source_system` of the rules a connection resolves against (server: source-system.ts). */
export function sourceSystemOf(type: SourceType | null | undefined): string {
  if (type === 'mqtt') return 'MQTT';
  return 'PI';
}

export const SOURCE_SYSTEM_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'PI', label: 'PI connections' },
  { value: 'MQTT', label: 'MQTT connections' },
  { value: '*', label: 'Every kind of connection' },
];

/** The editor's state of one source → plant rule (strings as typed; converted on save). */
export interface MappingForm {
  matchKind: MatchKind;
  matchValue: string;
  targetType: MappingTargetType;
  targetId: string;
  precedence: string;
  /** '' = every connection */
  connectionId: string;
  /** used only for "every connection" rules */
  sourceSystem: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  description: string;
}

export type MappingFormErrors = Partial<Record<keyof MappingForm, string>>;

export function emptyMappingForm(): MappingForm {
  return {
    matchKind: 'exact_path',
    matchValue: '',
    targetType: 'unit',
    targetId: '',
    precedence: '0',
    connectionId: '',
    sourceSystem: 'PI',
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true,
    description: '',
  };
}

export function mappingFormOf(rule: SourceMappingView): MappingForm {
  return {
    matchKind: rule.matchKind,
    matchValue: rule.matchValue,
    targetType: rule.targetType,
    targetId: rule.targetId,
    precedence: String(rule.precedence),
    connectionId: rule.connectionId ?? '',
    sourceSystem: rule.sourceSystem,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    isActive: rule.isActive,
    description: rule.description ?? '',
  };
}

/** Client checks that mirror the server's DTO (the server stays the judge: 409 MAPPING_EXISTS, 422). */
export function mappingFormErrors(form: MappingForm): MappingFormErrors {
  const errors: MappingFormErrors = {};
  if (!form.matchValue.trim()) errors.matchValue = 'Enter the source value to match.';
  if (!form.targetId) errors.targetId = `Choose the ${form.targetType}.`;
  const precedence = Number(form.precedence);
  if (!Number.isInteger(precedence) || precedence < -1000 || precedence > 1000) errors.precedence = 'Enter a whole number from -1000 to 1000.';
  if (form.effectiveFrom && form.effectiveTo && form.effectiveFrom >= form.effectiveTo) errors.effectiveTo = 'The end must be after the start.';
  return errors;
}

/** Body of POST /source-mappings and PUT /source-mappings/{id} (the whole rule). */
export function mappingBody(form: MappingForm, connectionType: SourceType | null): SourceMappingBody {
  return {
    matchKind: form.matchKind,
    matchValue: form.matchValue.trim(),
    targetType: form.targetType,
    targetId: form.targetId,
    precedence: Number(form.precedence),
    connectionId: form.connectionId || null,
    sourceSystem: form.connectionId ? sourceSystemOf(connectionType) : form.sourceSystem,
    effectiveFrom: form.effectiveFrom,
    effectiveTo: form.effectiveTo,
    isActive: form.isActive,
    description: form.description.trim() || null,
  };
}

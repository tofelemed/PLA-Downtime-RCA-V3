import type { CatalogField, FieldRule, FieldValueType } from '@/api/v2/types/integration-mappings';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NativeSelect } from '../components/native-select';
import { DURATION_UNITS, type RulePatch } from '../model/mapping-draft';

export interface MappingRulesTableProps {
  draft: readonly FieldRule[];
  changed: readonly FieldRule[];
  /** target fields of the override version in force */
  overrideFields: ReadonlySet<string>;
  catalog: readonly CatalogField[];
  onPatch: (targetField: string, patch: RulePatch) => void;
}

const option = (value: string) => ({ value, label: value });

/** One row per mapped catalog field; draft and override fields are marked, types come from the catalog. */
export function MappingRulesTable({ draft, changed, overrideFields, catalog, onPatch }: MappingRulesTableProps) {
  const drafted = new Set(changed.map((rule) => rule.targetField));
  return (
    <div className="overflow-x-auto">
      <Table data-testid="mapping-rules">
        <TableHeader>
          <TableRow>
            <TableHead>Event field</TableHead>
            <TableHead>Source attribute</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Origin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {draft.map((rule) => {
            const types = catalog.find((field) => field.name === rule.targetField)?.types ?? [rule.type];
            return (
              <TableRow key={rule.targetField} data-testid="mapping-rule" data-field={rule.targetField}>
                <TableCell className="font-medium">{rule.targetField}</TableCell>
                <TableCell>
                  <Input aria-label={`Source attribute for ${rule.targetField}`} value={rule.sourceAttr} onChange={(event) => onPatch(rule.targetField, { sourceAttr: event.target.value })} />
                </TableCell>
                <TableCell>
                  <NativeSelect id={`type-${rule.targetField}`} ariaLabel={`Type for ${rule.targetField}`} value={rule.type} options={types.map(option)} onChange={(type) => onPatch(rule.targetField, { type: type as FieldValueType })} />
                </TableCell>
                <TableCell>
                  {rule.type === 'duration' ? (
                    <NativeSelect
                      id={`unit-${rule.targetField}`}
                      testId={`unit-${rule.targetField}`}
                      ariaLabel={`Duration unit for ${rule.targetField}`}
                      value={rule.unit ?? 'seconds'}
                      options={DURATION_UNITS.map(option)}
                      onChange={(unit) => onPatch(rule.targetField, { unit: unit as RulePatch['unit'] })}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {drafted.has(rule.targetField) ? (
                    <Badge data-testid="rule-draft">draft</Badge>
                  ) : overrideFields.has(rule.targetField) ? (
                    <Badge variant="secondary">override</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">default</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

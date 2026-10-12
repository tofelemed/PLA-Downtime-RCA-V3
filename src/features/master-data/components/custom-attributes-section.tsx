import { useState } from 'react';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { friendlyToastContent } from '@/features/ux-kit/errors';
import { IconButton } from '@/features/ux-kit/icon-button';
import { Section } from '@/features/ux-kit/page-layout';
import { useToast } from '@/hooks/use-toast';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { ActionIcon } from '@/lib/icons';
import type { CustomAttributeDefinition, EntityType } from '@/types/CustomAttributes';
import { useCustomAttributes, useSetCustomAttribute, type AttributeRow } from '../api/use-custom-attributes';
import { AttributeValueDialog } from './attribute-value-dialog';

export interface CustomAttributesSectionProps {
  entityType: Extract<EntityType, 'Unit' | 'Asset'>;
  entityId: string;
  organizationId?: string;
  canWrite: boolean;
}

function useDisplayValue() {
  const pref = useCalendarPreference();
  return (definition: CustomAttributeDefinition, value: string): string => {
    if (!value) return '—';
    if (definition.dataType === 'boolean') return value === 'true' ? 'Yes' : 'No';
    if (definition.dataType === 'date') return formatOperationalDate(value.slice(0, 10), pref);
    return value;
  };
}

/**
 * Plant-defined extra fields of a unit or asset (custom attributes): their values, editable by master-data
 * writers one at a time. Which attributes exist is managed with the attribute definitions.
 */
export function CustomAttributesSection({ entityType, entityId, organizationId, canWrite }: CustomAttributesSectionProps) {
  const { toast } = useToast();
  const attributes = useCustomAttributes(entityType, entityId, organizationId);
  const setValue = useSetCustomAttribute(entityType, entityId);
  const [editing, setEditing] = useState<AttributeRow | null>(null);
  const display = useDisplayValue();
  const columns: DataTableColumn<AttributeRow>[] = [
    { id: 'name', header: 'Attribute', cell: (row) => row.definition.displayName },
    { id: 'value', header: 'Value', cell: (row) => display(row.definition, row.value) },
    ...(canWrite
      ? [{
          id: 'edit',
          header: '',
          headerLabel: 'Actions',
          align: 'right' as const,
          cell: (row: AttributeRow) => (
            <IconButton icon={ActionIcon.edit} label={`Edit ${row.definition.displayName}`} onClick={() => setEditing(row)} />
          ),
        }]
      : []),
  ];
  const save = (value: string) =>
    setValue.mutateAsync({ definitionId: editing?.definition.id ?? '', value }).catch((error: unknown) => {
      toast({ ...friendlyToastContent(error), variant: 'destructive' });
      throw error;
    });
  return (
    <Section title="Custom attributes" collapsible defaultOpen={false}>
      <DataTable
        caption="Custom attributes"
        columns={columns}
        rows={attributes.data ?? []}
        getRowKey={(row) => row.definition.id}
        status={{ isLoading: attributes.isLoading, isError: attributes.isError, error: attributes.error, onRetry: () => void attributes.refetch() }}
        empty={{ title: 'No custom attributes', text: `No custom attribute is defined for ${entityType === 'Unit' ? 'units' : 'assets'}.` }}
      />
      {editing && (
        <AttributeValueDialog
          definition={editing.definition}
          value={editing.value}
          saving={setValue.isPending}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </Section>
  );
}

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusIcon, UiIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { type PickableCode, type ReasonTreeRow, reasonCodeLabel, reasonTreeRows } from './reason-code-options';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

/** Rows rendered at once; the search narrows a bigger library (the whole library stays searchable). */
export const PICKER_ROW_LIMIT = 200;
const NONE = '__none__';

export interface ReasonCodePickerProps {
  id: string;
  codes: readonly PickableCode[];
  value: string;
  onChange: (reasonCodeId: string) => void;
  label?: string;
  /** text of the empty choice; null = no empty choice */
  emptyLabel?: string | null;
  disabled?: boolean;
  error?: string;
}

interface ReasonTreeListProps {
  listId: string;
  rows: readonly ReasonTreeRow[];
  value: string;
  query: string;
  emptyLabel: string | null;
  onPick: (reasonCodeId: string) => void;
}

/** The tree rows of the open picker: groups as indented headings, leaves selectable, the empty choice first. */
function ReasonTreeList({ listId, rows, value, query, emptyLabel, onPick }: ReasonTreeListProps) {
  const { number } = useNumberFormat();
  const shown = rows.slice(0, PICKER_ROW_LIMIT);
  return (
    <CommandList id={listId} className="max-h-[min(320px,50vh)]">
      <CommandEmpty>{query ? `No reason code matches “${query}”.` : 'No reason codes in this plant.'}</CommandEmpty>
      {emptyLabel !== null && !query && (
        <CommandItem value={NONE} onSelect={() => onPick('')}>
          {emptyLabel}
        </CommandItem>
      )}
      {shown.map((row) => (
        <CommandItem
          key={row.id}
          value={row.id}
          disabled={!row.selectable}
          onSelect={() => onPick(row.id)}
          data-reason-id={row.id}
          style={{ paddingLeft: `${0.5 + row.depth}rem` }}
          className={cn(!row.selectable && 'font-medium text-muted-foreground data-[disabled=true]:opacity-100')}
        >
          <StatusIcon.selected className={cn('mr-2 h-4 w-4 shrink-0', row.id === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
          <span className="font-mono text-xs">{row.code}</span>
          <span className="ml-2">{row.name}</span>
        </CommandItem>
      ))}
      {rows.length > shown.length && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Showing {number(shown.length)} of {number(rows.length)} rows — type to narrow the list.
        </p>
      )}
    </CommandList>
  );
}

/**
 * FE-04: one reason-code picker for every screen — a searchable tree combobox (code and name), groups
 * indented as headings and only leaf codes selectable; arrows, Enter and Escape work from the search box.
 */
export function ReasonCodePicker({
  id,
  codes,
  value,
  onChange,
  label = 'Reason code',
  emptyLabel = '— none —',
  disabled,
  error,
}: ReasonCodePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => reasonTreeRows(codes, query), [codes, query]);
  const current = value ? (reasonCodeLabel(codes, value) ?? 'Unknown code') : null;
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };
  return (
    <div className="space-y-1">
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-labelledby={`${id}-label ${id}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            disabled={disabled}
            data-value={value}
            className={cn(
              'h-auto min-h-9 w-full justify-between whitespace-normal text-left font-normal',
              !current && 'text-muted-foreground',
            )}
          >
            <span className="min-w-0 break-words">{current ?? emptyLabel ?? 'Choose a reason code'}</span>
            <UiIcon.expand className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[18rem] p-0" align="start">
          <Command shouldFilter={false} label="Search reason codes">
            <CommandInput value={query} onValueChange={setQuery} placeholder="Search code or name…" />
            <ReasonTreeList listId={`${id}-list`} rows={rows} value={value} query={query} emptyLabel={emptyLabel} onPick={pick} />
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

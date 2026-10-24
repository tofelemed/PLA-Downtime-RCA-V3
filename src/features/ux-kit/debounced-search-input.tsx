import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { ActionIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';
import { useDebouncedValue } from './use-debounced-value';

export interface DebouncedSearchInputProps {
  /** the applied search text (e.g. from the URL or filter state) */
  value: string;
  /** receives the text once typing paused for `delayMs`; never the same value twice in a row */
  onChange: (debounced: string) => void;
  /** accessible name, e.g. "Search events" */
  label: string;
  placeholder?: string;
  delayMs?: number;
  className?: string;
  /** id of the input, so a visible <label htmlFor> names it */
  id?: string;
}

/** Typed text, debounced emission and the outside `value` kept in step without echoing it back. */
function useDebouncedText(value: string, onChange: (text: string) => void, delayMs: number) {
  const [text, setText] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    setText(value);
  }
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
    lastEmitted.current = value;
  }, [onChange, value]);
  const emit = useCallback((next: string) => {
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChangeRef.current(next);
  }, []);
  const debounced = useDebouncedValue(text, delayMs);
  useEffect(() => emit(debounced), [debounced, emit]);
  const clear = () => {
    setText('');
    emit('');
  };
  return { text, setText, clear };
}

/**
 * Search box for filters that drive server queries: shows typing immediately, emits after a 300 ms
 * pause, clears with the "Clear search" button or Escape (emitted at once), and follows `value` when
 * it changes from outside (e.g. "Reset filters").
 *
 * @example <DebouncedSearchInput label="Search codes" value={filters.q} onChange={(q) => setFilters({ ...filters, q })} />
 */
export function DebouncedSearchInput({ value, onChange, label, placeholder, delayMs = 300, className, id }: DebouncedSearchInputProps) {
  const { text, setText, clear } = useDebouncedText(value, onChange, delayMs);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || text === '') return;
    event.stopPropagation();
    clear();
  };
  return (
    <div className={cn('relative w-full max-w-sm', className)}>
      <ActionIcon.search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        className="pl-8 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {text !== '' && (
        <IconButton icon={ActionIcon.close} label="Clear search" tooltip={false} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={clear} />
      )}
    </div>
  );
}

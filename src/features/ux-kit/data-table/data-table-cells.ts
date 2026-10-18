import { createElement, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { assertNoRawId } from '@/features/ux-kit/labels/assert-no-raw-id';
import { NumberText } from '../number-text';
import type { DataTableColumn, DataTableDensity } from './data-table-types';

const ALIGN: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right tabular-nums',
  center: 'text-center',
};

const CELL_DENSITY: Record<DataTableDensity, string> = {
  comfortable: 'px-4 py-2.5',
  compact: 'px-3 py-1.5',
};

const HEAD_DENSITY: Record<DataTableDensity, string> = {
  comfortable: 'h-11 px-4',
  compact: 'h-9 px-3',
};

/** Classes of a body cell for its column and the table density. */
export function cellClass<T>(column: DataTableColumn<T>, density: DataTableDensity): string {
  return [CELL_DENSITY[density], ALIGN[column.align ?? 'left'], column.nowrap ? 'whitespace-nowrap' : ''].join(' ');
}

/** Classes of a header cell for its column and the table density. */
export function headClass<T>(column: DataTableColumn<T>, density: DataTableDensity): string {
  return [HEAD_DENSITY[density], ALIGN[column.align ?? 'left'], 'whitespace-nowrap'].join(' ');
}

/**
 * Cell content; plain text is checked (dev only) for internal ids that must never reach users. A plain
 * number (a count, a position) is shown in the plant's digits (`NumberText`).
 */
export function renderCellValue<T>(column: DataTableColumn<T>, row: T, index: number, caption: string): ReactNode {
  const value = column.cell(row, index);
  if (typeof value === 'string' || typeof value === 'number') assertNoRawId(value, `${caption} › ${column.id}`);
  return typeof value === 'number' ? createElement(NumberText, { value }) : value;
}

const INTERACTIVE = 'a,button,input,select,textarea,label,[role="button"],[role="menuitem"],[role="checkbox"]';

/** True when the event started on a control inside the row (that control handles it, not the row). */
function fromNestedControl(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>): boolean {
  const control = (event.target as HTMLElement).closest(INTERACTIVE);
  return control !== null && control !== event.currentTarget && event.currentTarget.contains(control);
}

/** Props that make a row activatable; empty for read-only rows. */
export interface RowActivationProps {
  tabIndex?: number;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Click / Enter / Space handlers and focus props of an activatable row (H-10). The row never gets an
 * `aria-label` (it would replace the cell text for screen readers). With `hasLink` the row's link cell is
 * the keyboard path, so the row is clickable with the mouse but adds no tab stop of its own.
 */
export function rowActivationProps(activate: (() => void) | undefined, hasLink = false): RowActivationProps {
  if (!activate) return {};
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (!fromNestedControl(event)) activate();
  };
  if (hasLink) return { className: 'cursor-pointer', onClick };
  return {
    tabIndex: 0,
    className: 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    onClick,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      activate();
    },
  };
}

/**
 * Visually hidden action text at the start of the first cell of a keyboard-activatable row (e.g. "Open
 * case Pump trip."), read together with the cell text instead of replacing it.
 */
export function rowLabelHint(label: string | undefined): ReactNode {
  return label ? createElement('span', { className: 'sr-only' }, `${label}. `) : null;
}

/** The hint text of a row: only rows that are their own tab stop (activatable, without a link cell). */
export function rowHintOf<T>(row: T, opts: { onRowClick?: (row: T) => void; rowLabel?: (row: T) => string; rowsHaveLink?: boolean }): string | undefined {
  return opts.onRowClick && !opts.rowsHaveLink ? opts.rowLabel?.(row) : undefined;
}

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { assertNoRawId } from '@/features/ux-kit/labels/assert-no-raw-id';
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

/** Cell content; plain text is checked (dev only) for internal ids that must never reach users. */
export function renderCellValue<T>(column: DataTableColumn<T>, row: T, index: number, caption: string): ReactNode {
  const value = column.cell(row, index);
  if (typeof value === 'string' || typeof value === 'number') assertNoRawId(value, `${caption} › ${column.id}`);
  return value;
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
  'aria-label'?: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

/** Click / Enter / Space handlers and focus props of an activatable row. */
export function rowActivationProps(activate: (() => void) | undefined, label: string | undefined): RowActivationProps {
  if (!activate) return {};
  return {
    tabIndex: 0,
    'aria-label': label,
    className: 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (!fromNestedControl(event)) activate();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      activate();
    },
  };
}

import type { ReactNode } from 'react';

/** A value with nothing to show: null / undefined / false, or a string of only whitespace. */
export const isBlank = (value: ReactNode): boolean =>
  value === null || value === undefined || value === false || (typeof value === 'string' && value.trim() === '');

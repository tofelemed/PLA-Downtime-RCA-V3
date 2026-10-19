import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EffectiveFrom } from '../effective-from';
import { BUILT_IN_DEFAULT_NOTE, BUILT_IN_DEFAULT_START, effectiveFromText, isBuiltInDefaultStart, policyNoteText, sinceText } from './built-in-default';

const format = (iso: string | null | undefined) => `T(${iso})`;

describe('built-in default versions (QA M1, M7)', () => {
  it('detects the epoch sentinel up to 1970-01-02 UTC only', () => {
    expect(isBuiltInDefaultStart('1970-01-01T00:00:00Z')).toBe(true);
    expect(isBuiltInDefaultStart('1970-01-01T03:30:00+03:30')).toBe(true);
    expect(isBuiltInDefaultStart('1970-01-02T00:00:00Z')).toBe(true);
    expect(isBuiltInDefaultStart('1970-01-02T00:00:01Z')).toBe(false);
    expect(isBuiltInDefaultStart('2026-10-17T02:00:00Z')).toBe(false);
    expect(isBuiltInDefaultStart(null)).toBe(false);
    expect(isBuiltInDefaultStart('not a date')).toBe(false);
  });

  it('says "Built-in default (from the start)" instead of 1970-01-01 03:30', () => {
    expect(effectiveFromText('1970-01-01T00:00:00Z', format)).toBe(BUILT_IN_DEFAULT_START);
    expect(effectiveFromText('2026-10-17T02:00:00Z', format)).toBe('T(2026-10-17T02:00:00Z)');
    expect(sinceText('1970-01-01T00:00:00Z', format)).toBe('Built-in default (from the start)');
    expect(sinceText('2026-10-17T02:00:00Z', format)).toBe('since T(2026-10-17T02:00:00Z)');
  });

  it('EffectiveFrom renders the label or the plant time with its prefix', () => {
    const { rerender } = render(<p data-testid="line"><EffectiveFrom iso="1970-01-01T00:00:00Z" tz="Asia/Tehran" prefix="since" /></p>);
    expect(screen.getByTestId('line')).toHaveTextContent('Built-in default (from the start)');
    expect(screen.getByTestId('line')).not.toHaveTextContent('1970');
    rerender(<p data-testid="line"><EffectiveFrom iso="2026-10-17T02:00:00Z" tz="Asia/Tehran" prefix="since" /></p>);
    expect(screen.getByTestId('line')).toHaveTextContent('since 2026-10-17 05:30');
  });

  it('maps the internal seed notes to plain words and keeps other notes', () => {
    expect(policyNoteText('Seeded on first use from the D04 / D05 / D06 / D13 default (DECISIONS.md, 2026-10-07); change by a new version.')).toBe(BUILT_IN_DEFAULT_NOTE);
    expect(policyNoteText('Seeded by migration AccountingEngine from the D04 / D06 defaults (DECISIONS.md, 2026-10-07); change by a new version.')).toBe(BUILT_IN_DEFAULT_NOTE);
    expect(policyNoteText('Commissioning of Extruder 1')).toBe('Commissioning of Extruder 1');
    expect(policyNoteText(null)).toBeNull();
  });
});

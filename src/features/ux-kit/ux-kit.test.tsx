import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { V2ApiError } from '@/api/v2/errors';
import { DataState } from './data-state';
import { dataStateOf } from './data-state-of';
import { DecimalInput } from './decimal-input';
import { DurationText } from './duration-text';
import { formatDecimal, parseDecimalInput, roundDecimal } from './format/decimal';
import { formatDuration } from './format/duration';
import { formatPlantTime } from './format/plant-time';
import { PlantTime } from './plant-time';
import { Quantity } from './quantity';
import { freshnessOf } from './format/freshness';
import { ScopeHeader } from './scope-header';

const apiError = (status: number, code: string) =>
  new V2ApiError(status, { code, message: code, correlationId: 'corr-9', retryable: false });

describe('UX kit formatting (plan 3.1)', () => {
  it('DurationText(5400) → "1 h 30 min", compact "90 min", KPI clock "1:30"', () => {
    render(<DurationText seconds={5400} />);
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
    expect(formatDuration(5400, 'compact')).toBe('90 min');
    expect(formatDuration('5400.000', 'clock')).toBe('1:30');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
  });

  it('PlantTime shows plant wall clock with offset and zone', () => {
    render(<PlantTime iso="2026-10-09T02:00:00Z" tz="Asia/Dubai" />);
    expect(screen.getByText('06:00 (+04:00 Asia/Dubai)')).toBeInTheDocument();
    expect(formatPlantTime('2026-10-09T02:30:00Z', 'Asia/Tehran', true)).toBe('2026-10-09 06:00 (+03:30 Asia/Tehran)');
    expect(formatPlantTime('2026-10-09T02:30:00Z', 'UTC')).toBe('02:30 (+00:00 UTC)');
    expect(formatPlantTime('2026-10-09T02:30:00Z', 'Not/AZone')).toBe('02:30 (+00:00 UTC)');
    expect(formatPlantTime('nope', 'UTC')).toBe('—');
  });

  it('formats decimal strings without floating point and always with a unit', () => {
    expect(roundDecimal('0.125', 2)).toBe('0.13');
    expect(roundDecimal('9.995', 2)).toBe('10.00');
    expect(roundDecimal('-0.001', 2)).toBe('0.00');
    expect(formatDecimal('12345678.905')).toBe('12,345,678.91');
    expect(formatDecimal('0.1', 0)).toBe('0');
    render(<Quantity value="1234.5" uom="t" />);
    expect(screen.getByText('1,234.50')).toBeInTheDocument();
    expect(screen.getByText('t')).toBeInTheDocument();
    render(<Quantity value="2" uom={null} />);
    expect(screen.getByText('(unit unknown)')).toBeInTheDocument();
  });

  it('DecimalInput keeps a string value with at most 8 decimals', () => {
    expect(parseDecimalInput('1,234.12345678')).toEqual({ value: '1234.12345678', error: null });
    expect(parseDecimalInput('1.123456789').error).toBe('At most 8 decimal places');
    expect(parseDecimalInput('-1').error).toBe('Must not be negative');
    expect(parseDecimalInput('abc').error).toBe('Enter a number');
    const Harness = () => {
      const [value, setValue] = useState<string | null>(null);
      return (
        <>
          <DecimalInput aria-label="qty" value={value} onChange={setValue} />
          <output>{value ?? 'empty'}</output>
        </>
      );
    };
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('qty'), { target: { value: '0.30000000' } });
    expect(screen.getByText('0.30000000')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('qty'), { target: { value: '0.123456789' } });
    expect(screen.getByText('At most 8 decimal places')).toBeInTheDocument();
    expect(screen.getByText('0.30000000')).toBeInTheDocument();
  });
});

describe('UX states and scope header (plan 3.1, UX03)', () => {
  it('maps queries to the seven states', () => {
    const idle = { isLoading: false, isError: false, error: null };
    expect(dataStateOf({ ...idle, isLoading: true })).toBe('loading');
    expect(dataStateOf({ ...idle, isError: true, error: apiError(403, 'FORBIDDEN') })).toBe('no-permission');
    expect(dataStateOf({ ...idle, isError: true, error: apiError(503, 'SOURCE_OFFLINE') })).toBe('source-offline');
    expect(dataStateOf({ ...idle, isError: true, error: apiError(500, 'INTERNAL_ERROR') })).toBe('error');
    expect(dataStateOf(idle, { isEmpty: true })).toBe('empty');
    expect(dataStateOf(idle, { isIncomplete: true })).toBe('incomplete');
    expect(dataStateOf(idle, { isCalculationPending: true })).toBe('calculation-pending');
    expect(dataStateOf(idle)).toBe('ready');
  });

  it('an error state shows the correlation id; incomplete still shows the content', () => {
    render(<DataState state="error" error={apiError(500, 'INTERNAL_ERROR')} />);
    expect(screen.getByText('Reference: corr-9')).toBeInTheDocument();
    render(
      <DataState state="incomplete" detail="2 of 21 shifts have no actuals">
        <p>table</p>
      </DataState>,
    );
    expect(screen.getByText('2 of 21 shifts have no actuals')).toBeInTheDocument();
    expect(screen.getByText('table')).toBeInTheDocument();
  });

  it('an error state of a 4xx refusal shows its code and message; a 5xx stays generic', () => {
    render(<DataState state="error" error={apiError(422, 'TOO_MANY_PERIODS')} />);
    expect(screen.getByText('Refused (TOO_MANY_PERIODS)')).toBeInTheDocument();
    expect(screen.queryByText('The request failed.')).toBeNull();
    render(<DataState state="error" error={apiError(500, 'INTERNAL_ERROR')} />);
    expect(screen.getByText('Could not load')).toBeInTheDocument();
    expect(screen.getByText('The request failed.')).toBeInTheDocument();
  });

  it('ScopeHeader shows scope, zone with offset, unit, baseline, provisional and freshness', () => {
    const now = Date.parse('2026-10-09T03:00:00Z');
    render(<ScopeHeader scopeLabel="HDPE · unit100" timezone="Asia/Tehran" uom="t" baseline="Plan v2" isProvisional asOf="2026-10-09T02:55:00Z" now={now} />);
    const header = screen.getByTestId('scope-header');
    expect(header).toHaveTextContent('HDPE · unit100');
    expect(header).toHaveTextContent('Asia/Tehran (+03:30)');
    expect(header).toHaveTextContent('Unit: t');
    expect(header).toHaveTextContent('Baseline: Plan v2');
    expect(header).toHaveTextContent('Provisional');
    expect(header).toHaveTextContent('As of 2026-10-09 06:25 (+03:30 Asia/Tehran) · 5 min ago');
    expect(freshnessOf(null, now)).toBeNull();
  });
});

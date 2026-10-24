import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlantTimezoneReadout } from './plant-timezone-readout';

const timezone = vi.hoisted(() => ({ value: { timezone: 'Asia/Tehran', source: 'site', loading: false } }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => timezone.value }));

describe('PlantTimezoneReadout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('shows the zone and its UTC offset', () => {
    timezone.value = { timezone: 'Asia/Tehran', source: 'site', loading: false };
    render(<PlantTimezoneReadout />);
    expect(screen.getByText('Asia/Tehran · UTC+03:30')).toBeInTheDocument();
  });

  it('says so, as a status, when the zone is unknown', () => {
    timezone.value = { timezone: 'UTC', source: 'utc-fallback', loading: false };
    render(<PlantTimezoneReadout />);
    expect(screen.getByText('Plant timezone unknown — times in UTC')).toHaveAttribute('role', 'status');
  });

  it.each([
    ['UTC', '2026-01-15T12:00:00Z', 'UTC · UTC+00:00'],
    ['Europe/Berlin', '2026-01-15T12:00:00Z', 'Europe/Berlin · UTC+01:00'],
    ['Europe/Berlin', '2026-07-15T12:00:00Z', 'Europe/Berlin · UTC+02:00'],
  ])('shows %s at %s as "%s" (zero offset and daylight saving)', (zone, now, expected) => {
    vi.setSystemTime(new Date(now));
    timezone.value = { timezone: zone, source: 'tenant', loading: false };
    render(<PlantTimezoneReadout />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

import { describe, expect, it } from 'vitest';
import { nextPlantDayUtc, plantLocalToUtc, startOfPlantDayUtc, utcToPlantLocal } from './zoned-time';

describe('zoned-time', () => {
  it('converts the plant wall clock to UTC and back', () => {
    expect(plantLocalToUtc('2026-10-09T08:30', 'Asia/Tehran')).toBe('2026-10-09T05:00:00.000Z');
    expect(utcToPlantLocal('2026-10-09T05:00:00.000Z', 'Asia/Tehran')).toBe('2026-10-09T08:30');
    expect(plantLocalToUtc('2026-10-09T08:30', 'Not/AZone')).toBe('2026-10-09T08:30:00.000Z');
    expect(plantLocalToUtc('garbage', 'UTC')).toBeNull();
    expect(utcToPlantLocal(null, 'UTC')).toBe('');
    expect(utcToPlantLocal('nope', 'UTC')).toBe('');
  });

  it('is DST-safe (America/New_York)', () => {
    expect(plantLocalToUtc('2026-03-08T01:30', 'America/New_York')).toBe('2026-03-08T06:30:00.000Z');
    expect(plantLocalToUtc('2026-03-08T03:30', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
    expect(plantLocalToUtc('2026-07-01T12:00', 'America/New_York')).toBe('2026-07-01T16:00:00.000Z');
    expect(utcToPlantLocal('2026-11-01T06:30:00Z', 'America/New_York')).toBe('2026-11-01T01:30');
  });

  it('gives half-open plant-day bounds', () => {
    expect(startOfPlantDayUtc('2026-10-12', 'Asia/Tehran')).toBe('2026-10-11T20:30:00.000Z');
    expect(nextPlantDayUtc('2026-10-12', 'Asia/Tehran')).toBe('2026-10-12T20:30:00.000Z');
    expect(nextPlantDayUtc('2026-12-31', 'UTC')).toBe('2027-01-01T00:00:00.000Z');
    expect(startOfPlantDayUtc('2026-11-01', 'America/New_York')).toBe('2026-11-01T04:00:00.000Z');
    expect(nextPlantDayUtc('2026-11-01', 'America/New_York')).toBe('2026-11-02T05:00:00.000Z');
    expect(startOfPlantDayUtc('12/10/2026', 'UTC')).toBeNull();
    expect(nextPlantDayUtc('', 'UTC')).toBeNull();
  });
});

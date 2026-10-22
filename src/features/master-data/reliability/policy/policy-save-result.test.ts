import { describe, expect, it } from 'vitest';
import { policySaveResult } from './policy-save-result';

const dateTime = (iso: string) => `at:${iso}`;
const saved = { version: 7, effectiveFrom: '2026-10-22T08:00:00.000Z' };

describe('policySaveResult (save feedback of a new stop / plan policy version)', () => {
  it('plant-wide: "<what> version N recorded", back to the page, Next: the setup step after Stop and plan policy', () => {
    const result = policySaveResult({ what: 'Stop-engine settings', saved, unitId: '', dateTime });
    expect(result.title).toBe('Stop-engine settings version 7 recorded');
    expect(result.message).toBe('Applies plant-wide from at:2026-10-22T08:00:00.000Z. Periods already calculated keep the version they used.');
    expect(result.listPath).toBe('/master-data/stop-policy');
    expect(result.listLabel).toBe('Stop and plan policy');
    expect(result.next).toEqual({ label: 'Unit impact rules', path: '/master-data/unit-impact-rules' });
  });

  it('a unit override keeps the unit on Back and Next', () => {
    const result = policySaveResult({ what: 'Micro-stop settings', saved, unitId: 'u 1', dateTime });
    expect(result.message).toMatch(/^Applies to the chosen unit from /);
    expect(result.listPath).toBe('/master-data/stop-policy?unitId=u%201');
    expect(result.next?.path).toBe('/master-data/unit-impact-rules?unitId=u%201');
  });
});

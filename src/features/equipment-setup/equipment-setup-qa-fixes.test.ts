import { describe, expect, it } from 'vitest';
import { capabilitiesOf } from '@/features/auth/capabilities';
import { lastPlantDay } from './readiness-model';
import { canOpenStep, setupStep } from './setup-steps';

describe('equipment setup QA fixes (2026-10-19)', () => {
  it('L15: a master-data admin opens the master-data steps read-only; other pages keep their capability', () => {
    const bahram = capabilitiesOf(['master_data_admin']);
    expect(bahram.canWriteOeePolicy).toBe(false);
    expect(canOpenStep(setupStep('stop-policy'), bahram)).toBe(true);
    expect(canOpenStep(setupStep('state'), bahram)).toBe(true);
    expect(canOpenStep(setupStep('connection'), bahram)).toBe(false);
    const operator = capabilitiesOf(['operator']);
    expect(canOpenStep(setupStep('stop-policy'), operator)).toBe(false);
  });

  it('L14: the default readiness window is the last whole plant day, end exclusive internally', () => {
    const now = Date.parse('2026-10-19T08:00:00Z'); // 11:30 in Tehran
    expect(lastPlantDay('Asia/Tehran', now)).toEqual({ from: '2026-10-17T20:30:00.000Z', to: '2026-10-18T20:30:00.000Z' });
  });
});

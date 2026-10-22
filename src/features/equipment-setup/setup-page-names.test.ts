import { describe, expect, it } from 'vitest';
import { pageNameOf } from '@/features/auth/navigation-items';
import { sectionNameOf } from '@/features/master-data/components/master-data-sections';
import { setupStep } from './setup-steps';

describe('setup guide link texts use page names (QA re-test N5)', () => {
  it('names each step that opens one page by that page', () => {
    expect(setupStep('codes').title).toBe('Codes & rules');
    expect(setupStep('state').title).toBe('Unit state');
    expect(setupStep('authority').title).toBe('Source priority');
    expect(setupStep('stop-policy').title).toBe(sectionNameOf('/master-data/stop-policy'));
    expect(setupStep('impact').title).toBe(sectionNameOf('/master-data/unit-impact-rules'));
    const related = setupStep('analysis').related?.map((link) => link.label);
    expect(related).toEqual([pageNameOf('/pla-analytics'), 'Month close', 'RCA Analysis']);
  });

  it('the plant step opens Setup › Organizations & plants (22 Oct 2026), Plant settings stays in the Admin panel', () => {
    const plant = setupStep('plant');
    expect([plant.page, plant.to({ unitId: '' }), plant.capability]).toEqual(['Organizations & plants', '/setup/plants', 'canAdministerTenant']);
    expect(plant.related).toEqual([{ label: 'Plant settings', to: '/admin?tab=settings' }]);
  });
});

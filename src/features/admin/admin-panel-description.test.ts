import { describe, expect, it } from 'vitest';
import { adminPanelDescription } from './admin-panel-description';

describe('Admin panel description (QA_SHELL)', () => {
  it('names only the visible tabs', () => {
    expect(adminPanelDescription(['settings'])).toBe('Plant settings.');
    expect(adminPanelDescription(['attributes', 'automation', 'settings'])).toBe('Custom attributes, status automation and plant settings.');
    expect(adminPanelDescription(['attributes', 'branding', 'automation', 'settings'])).toBe('Custom attributes, branding, status automation and plant settings.');
    // organizations and plants moved to Setup (22 Oct 2026): an old tab name is not described
    expect(adminPanelDescription(['plants', 'settings'])).toBe('Plant settings.');
    expect(adminPanelDescription([])).toBe('');
  });
});

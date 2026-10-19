import { describe, expect, it } from 'vitest';
import { adminPanelDescription } from './admin-panel-description';

describe('Admin panel description (QA_SHELL)', () => {
  it('names only the visible tabs', () => {
    expect(adminPanelDescription(['settings'])).toBe('Plant settings.');
    expect(adminPanelDescription(['plants', 'attributes', 'automation', 'settings'])).toBe('Plants and organizations, custom attributes, status automation and plant settings.');
    expect(adminPanelDescription([])).toBe('');
  });
});

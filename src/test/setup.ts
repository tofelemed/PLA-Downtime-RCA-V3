import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy / waitFor give a lazily loaded page up to 5 s (default 1 s): under a full parallel run the
// heavier pages (RCA workspace, analysis, admin) render later than 1 s and failed intermittently
configure({ asyncUtilTimeout: 5000 });

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Extend Vitest's expect with jest-dom matchers
expect.extend({
  // Add any custom matchers here if needed
});


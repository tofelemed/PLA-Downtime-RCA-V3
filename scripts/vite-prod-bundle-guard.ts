import type { Plugin } from 'vite';

/**
 * Production-build guard (plan 3.1 step 7): fails `vite build` when a chunk contains development or
 * demo modules — console helpers, browser seeders and scripts (all removed with the v1 code on
 * 13 Oct 2026; demo data comes from the backend seeders), the UX kit playground.
 */
export const FORBIDDEN_IN_PRODUCTION: readonly RegExp[] = [
  /\/src\/dev\//,
  /\/src\/scripts\//,
  /\/src\/features\/ux-kit\/ux-kit-playground\.tsx$/,
  /\/src\/.*Seeder\.tsx?$/,
];

const normalize = (id: string) => id.replace(/\\/g, '/').replace(/\?.*$/, '');

export function prodBundleGuard(forbidden: readonly RegExp[] = FORBIDDEN_IN_PRODUCTION): Plugin {
  return {
    name: 'proact-prod-bundle-guard',
    apply: 'build',
    generateBundle(_options, bundle) {
      const hits: string[] = [];
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          const path = normalize(id);
          if (forbidden.some((pattern) => pattern.test(path))) hits.push(`${output.fileName}: ${path}`);
        }
      }
      if (hits.length > 0) {
        this.error(`Development/demo code in the production bundle:\n${hits.join('\n')}`);
      }
    },
  };
}

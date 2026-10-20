import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAVIGATION_ITEMS, NAV_SECTIONS, pageNameOf } from './navigation-items';

/**
 * QA M9: one name per page. The menu name (also the breadcrumb and the No-access title, see
 * `withMenuGates`) is the page's h1 / tab title, in sentence case (docs/GLOSSARY.md). Product names keep
 * their capitals: "Event Hub" and "RCA Analysis" (glossary), acronyms (PLA, OEE, MTBF/MTTR) and Pareto.
 */
const PROPER_NAMES: ReadonlySet<string> = new Set(['Event Hub', 'RCA Analysis']);
const CAPITALISED_WORDS: ReadonlySet<string> = new Set(['Pareto']);

function isSentenceCase(name: string): boolean {
  if (PROPER_NAMES.has(name)) return true;
  const [first, ...rest] = name.split(' ');
  if (!/^[A-Z(]/.test(first)) return false;
  return rest.every((word) => word === word.toLowerCase() || word === word.toUpperCase() || CAPITALISED_WORDS.has(word));
}

/** The file that renders the h1 of each menu page (the analysis pages compose "Section · label"). */
const PAGE_FILES: Readonly<Record<string, string>> = {
  '/dashboard': 'pla-analytics/dashboard/analytics-dashboard.tsx',
  '/approvals': 'approvals/approval-inbox-page.tsx',
  '/reports': 'pla-analytics/reports/reports-header.tsx',
  '/events': 'event-hub/event-hub-page.tsx',
  '/planning': 'plans-profiles-calendars/planning-page.tsx',
  '/my-queue': 'month-close/my-queue-page.tsx',
  '/month-close': 'month-close/month-close-page.tsx',
  '/measurement-uncertainty': 'measurement-uncertainty/uncertainty-page.tsx',
  '/period-accounting': 'shell/period-accounting/period-accounting-page.tsx',
  '/rca': 'rca/pages/rca-list-page.tsx',
  '/reliability/bad-actors': 'rca/bad-actors/bad-actor-page.tsx',
  '/reliability/causes': 'rca/causes-report/cause-report-page.tsx',
  '/reliability/portfolio': 'rca/portfolio/portfolio-page.tsx',
  '/rca-knowledge-base': 'rca-knowledge/rca-knowledge-page.tsx',
  '/tasks': 'tasks/tasks-page.tsx',
  '/connectivity': 'integration-console/pages/console-page.tsx',
  '/connectivity/source-status': 'integration-console/status-mappings/status-mappings-page.tsx',
  '/connectivity/source-authority': 'integration-console/source-authority/source-authority-page.tsx',
  '/enhanced-historian': 'integration-console/historian/historian-page.tsx',
  '/equipment-setup': 'equipment-setup/equipment-setup-page.tsx',
  '/master-data': 'master-data/overview/master-data-overview-page.tsx',
  '/finance': 'finance/finance-page.tsx',
  '/users': 'users/user-management-page.tsx',
  '/delegations': 'delegations/delegations-page.tsx',
  '/admin': 'admin/admin-page.tsx',
  '/audit': 'audit/audit-page.tsx',
};

const source = (file: string) => readFileSync(join(process.cwd(), 'src', 'features', file), 'utf8');

describe('page names (QA M9)', () => {
  it.each(NAVIGATION_ITEMS.map((item) => [item.name, item.label ?? item.name]))('menu name %s (sidebar %s) is in sentence case', (name, label) => {
    expect(isSentenceCase(name)).toBe(true);
    expect(isSentenceCase(label)).toBe(true);
  });

  it.each(NAV_SECTIONS.map((section) => section.label))('section %s is in sentence case', (label) => {
    expect(isSentenceCase(label)).toBe(true);
  });

  it.each(Object.entries(PAGE_FILES))('the h1 of %s is its menu name', (href, file) => {
    const text = source(file);
    const name = pageNameOf(href);
    expect(text.includes(`title="${name}"`) || text.includes(`title={pageNameOf('${href}')}`)).toBe(true);
  });

  it('a section and one of its pages never share a name (QA_SHELL: "Reliability" twice)', () => {
    const sections = new Set(NAV_SECTIONS.map((section) => section.label.toLowerCase()));
    expect(NAVIGATION_ITEMS.filter((item) => sections.has((item.label ?? item.name).toLowerCase())).map((item) => item.name)).toEqual([]);
  });

  it('pageNameOf refuses a path outside the menu', () => {
    expect(pageNameOf('/admin')).toBe('Admin panel');
    expect(() => pageNameOf('/no-such-page')).toThrow(/No menu page/);
  });
});

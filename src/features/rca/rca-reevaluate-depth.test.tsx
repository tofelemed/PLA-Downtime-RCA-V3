import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import type { RcaGateIssue } from '@/api/v2/types/rca-workflow';
import { RecommendationBadges } from './components/recommendation-badges';
import { GateList } from './case/workflow/gate-list';
import { gateMessage, type GateLinks } from './model/gate-messages';

const LINKS: GateLinks = { analysis: '/rca/c1/analysis', definition: '/rca/c1/definition', causes: '/rca/c1/analysis#causes' };

const issue = (code: string, extra: Partial<RcaGateIssue> = {}): RcaGateIssue => ({ code, field: 'x', message: 'server words', ...extra });

const REEVALUATE: RcaRecommendationView = {
  id: 'rec-1',
  eventId: 'e-9',
  occurrenceId: null,
  unitId: 'u-1',
  trigger: 'reevaluate',
  source: { kind: 'policy', id: 'p1', version: 2 },
  firedOn: 'after_closure',
  provisional: false,
  outcome: 'recommended',
  state: 'open',
  rcaId: 'c1',
  event: null,
  detail: { fires: true, incidents: 3, guardedRate: '4.1667', baselineRate: '1', version: 'rca-watch-v1' },
  firedAt: '2026-10-20T08:00:00Z',
  confirmedAt: '2026-10-20T08:00:00Z',
  resolvedAt: null,
};

describe('D-T4 gate messages per code', () => {
  it('METHOD_REQUIRED names the accepted methods and links each analysis tool', () => {
    const message = gateMessage(issue('METHOD_REQUIRED', { methods: ['logic_tree', 'fault_tree'] }), LINKS);
    expect(message.text).toBe('This consequence class needs a Logic tree or Fault tree with content.');
    expect(message.links.map((link) => link.to)).toEqual(['/rca/c1/analysis/logic-tree', '/rca/c1/analysis/fault-tree']);
  });

  it('the team charter and the class link to the Definition page; coded causes to the Causes panel', () => {
    expect(gateMessage(issue('TEAM_CHARTER_REQUIRED'), LINKS).links[0].to).toBe('/rca/c1/definition');
    expect(gateMessage(issue('CONSEQUENCE_CLASS_MISSING'), LINKS).links[0].to).toBe('/rca/c1/definition');
    const coded = gateMessage(issue('CODED_CAUSE_REQUIRED'), LINKS);
    expect(coded.text).toContain('root cause with a cause code');
    expect(coded.links[0].to).toBe('/rca/c1/analysis#causes');
  });

  it('other codes keep the server message', () => {
    expect(gateMessage(issue('ACTIONS_MISSING', { message: 'plan at least one corrective action' }), LINKS)).toEqual({
      text: 'Plan at least one corrective action',
      links: [],
    });
  });

  it('the gate list shows each blocker with its link', () => {
    render(
      <MemoryRouter>
        <GateList title="Needed" tone="blocker" testId="blockers" links={LINKS} issues={[issue('METHOD_REQUIRED', { methods: ['five_why'] }), issue('TEAM_CHARTER_REQUIRED')]} />
      </MemoryRouter>,
    );
    const list = screen.getByTestId('blockers');
    expect(within(list).getByTestId('gate-link-five-why')).toHaveAttribute('href', '/rca/c1/analysis/five-why');
    expect(within(list).getByTestId('gate-link-definition')).toHaveAttribute('href', '/rca/c1/definition');
  });
});

describe('D-T3 re-evaluate badge', () => {
  it('shows "Re-evaluate" with the recurrence against the baseline and links to the case', () => {
    render(
      <MemoryRouter>
        <RecommendationBadges items={[REEVALUATE]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('reevaluate-badge').textContent).toBe('Re-evaluate');
    expect(screen.getByTestId('recommendation-detail').textContent).toBe('3 incidents since closure: 4.17 per 1,000 run hours (baseline 1.00)');
    expect(screen.getByTestId('reevaluate-case-link')).toHaveAttribute('href', '/rca/c1#rca-workflow');
    expect(screen.queryByText(/Investigation recommended/)).toBeNull();
  });

  it('on the case itself the badge does not link back to it', () => {
    render(
      <MemoryRouter>
        <RecommendationBadges items={[REEVALUATE]} linkToCase={false} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('reevaluate-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('reevaluate-case-link')).toBeNull();
  });
});

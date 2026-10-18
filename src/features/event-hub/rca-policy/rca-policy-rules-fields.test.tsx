import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RcaPolicyRules } from './rca-policy-api';
import { rulesDraftOf } from './rca-policy-rules-draft';
import { RcaPolicyRulesFields } from './rca-policy-rules-fields';

const RULES: RcaPolicyRules = {
  effectiveness: { baselineLookbackDays: 90, minExposureHours: 720, requiredReduction: 0.5, reviewDays: 90, zeroRepeatClasses: ['major'], minimumCoverage: 0.95 },
  fmea: { method: 'rpn', rpnThreshold: 100, severityReview: 9, priorityRules: [] },
  fiveWhy: { guidelineLevels: 5, minLevels: 1, evidencePerLevel: true, unsupportedRootCauses: [] },
  investigation: {
    minor: { methodGroups: [], minTeamMembers: 0 },
    significant: { methodGroups: [], minTeamMembers: 2 },
    major: { methodGroups: [], minTeamMembers: 3 },
  },
};

describe('RCA policy effectiveness fields', () => {
  it('shows the minimum state-data coverage for a verdict as a percent and sends edits', () => {
    const set = vi.fn();
    render(<RcaPolicyRulesFields draft={rulesDraftOf(RULES)} set={set} />);
    const field = screen.getByLabelText('Minimum state-data coverage for a verdict (%)');
    expect(field).toHaveValue('95');
    fireEvent.change(field, { target: { value: '90' } });
    expect(set).toHaveBeenCalledWith('minimumCoveragePercent', '90');
  });
});

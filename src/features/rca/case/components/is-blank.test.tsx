import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaseWorkspaceContext } from '../case-context';
import { KIT_CASE } from '../analysis/analysis-test-kit';
import { ReadField } from '../analysis/tools/tool-fields';
import { CaseFact, CaseFacts } from './case-facts';
import { isBlank } from './is-blank';


describe('isBlank (ReadField and CaseFact)', () => {
  it('is true for null, undefined, false and whitespace-only strings; false for text, numbers and elements', () => {
    for (const value of [null, undefined, false, '', '   ', '\n\t']) expect(isBlank(value)).toBe(true);
    for (const value of ['x', ' x ', 0, 3, <span key="s">x</span>]) expect(isBlank(value)).toBe(false);
  });

  it('ReadField and CaseFact both read "Not recorded" for a whitespace-only value', () => {
    render(
      <CaseWorkspaceContext.Provider value={{ rca: KIT_CASE, readOnly: true, canWrite: false, closed: true, basePath: '/rca/c1' }}>
        <ReadField label="Problem" value="   " testId="read-field" />
        <CaseFacts>
          <CaseFact label="Source" testId="case-fact">
            {'  '}
          </CaseFact>
        </CaseFacts>
      </CaseWorkspaceContext.Provider>,
    );
    expect(screen.getByTestId('read-field')).toHaveTextContent('Not recorded');
    expect(screen.getByTestId('case-fact')).toHaveTextContent('Not recorded');
  });
});

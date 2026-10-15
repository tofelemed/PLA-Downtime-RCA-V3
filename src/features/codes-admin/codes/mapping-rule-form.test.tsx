import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MappingRuleForm } from './mapping-rule-form';

const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('@/api/v2/queries/codes-admin', () => ({
  useCodeList: () => ({ items: [] }),
  useCreateCodeMappingRule: () => ({ submit, isPending: false, error: null }),
}));

describe('mapping version save', () => {
  let complete: () => void;
  beforeEach(() => {
    submit.mockReset();
    submit.mockReturnValue(new Promise<void>((resolve) => { complete = resolve; }));
  });

  function startSave() {
    render(<MappingRuleForm reasonId="reason-1" />);
    fireEvent.change(screen.getByLabelText('Mapping'), { target: { value: 'reason_to_oee' } });
    fireEvent.change(screen.getByLabelText('Default'), { target: { value: 'availability' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as next version' }));
    expect(submit).toHaveBeenCalledWith({ ruleKind: 'reason_to_oee', sourceCodeId: 'reason-1', targetValue: 'availability' });
  }

  it('preserves a new choice made while the previous save refreshes its history', async () => {
    startSave();
    fireEvent.change(screen.getByLabelText('Default'), { target: { value: 'performance' } });
    await act(async () => { complete(); });
    expect(screen.getByLabelText('Default')).toHaveValue('performance');
    expect(screen.getByRole('button', { name: 'Save as next version' })).toBeEnabled();
  });

  it('clears the saved choice when the user has not started another version', async () => {
    startSave();
    await act(async () => { complete(); });
    expect(screen.getByLabelText('Default')).toHaveValue('');
  });
});

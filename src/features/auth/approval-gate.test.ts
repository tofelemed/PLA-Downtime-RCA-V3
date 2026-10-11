import { describe, expect, it } from 'vitest';
import { approvalAccess } from './approval-gate';

describe('approvalAccess', () => {
  it('hidden when the role can never approve, own for the author, allowed otherwise', () => {
    expect(approvalAccess(false, 'u2', 'u1')).toBe('hidden');
    expect(approvalAccess(true, 'u1', 'u1')).toBe('own');
    expect(approvalAccess(true, 'u2', 'u1')).toBe('allowed');
  });

  it('an unknown author leaves the decision to the server', () => {
    expect(approvalAccess(true, null, 'u1')).toBe('allowed');
    expect(approvalAccess(true, undefined, 'u1')).toBe('allowed');
  });
});

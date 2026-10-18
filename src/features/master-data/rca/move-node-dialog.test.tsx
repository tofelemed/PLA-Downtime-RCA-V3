import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { MoveNodeDialog } from './move-node-dialog';

describe('MoveNodeDialog', () => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  beforeEach(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }));
  afterEach(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('a refused move stays open and says why instead of failing silently', async () => {
    const onClose = vi.fn();
    const refusal = new V2ApiError(409, { code: 'STALE_ROW_VERSION', message: 'stale', correlationId: 'c-1', retryable: false });
    render(<MoveNodeDialog name="Seal failure" targets={[]} currentParentId="p1" onMove={() => Promise.reject(refusal)} onClose={onClose} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Top level' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(await screen.findByText('Could not move Seal failure')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled();
  });
});

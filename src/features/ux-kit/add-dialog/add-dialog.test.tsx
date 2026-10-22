import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AddDialog, useAddDialog } from '.';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function Harness() {
  const add = useAddDialog();
  return (
    <>
      <Button onClick={add.open}>Add thing</Button>
      <AddDialog open={add.isOpen} onOpenChange={add.setOpen} title="Add thing" testId="thing-dialog">
        <Button onClick={() => add.saved({ title: 'Thing added', listPath: '/things', listLabel: 'Things' })}>Save</Button>
      </AddDialog>
      {add.resultElement}
    </>
  );
}

describe('header Add dialog (SETUP_UX_FIXES Phase 4)', () => {
  it('opens from its button, closes on save into the result dialog, and Add another opens it again', async () => {
    render(<MemoryRouter initialEntries={['/things']}><Harness /></MemoryRouter>);
    expect(screen.queryByTestId('thing-dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add thing' }));
    fireEvent.click(within(screen.getByTestId('thing-dialog')).getByRole('button', { name: 'Save' }));
    const result = await screen.findByTestId('save-result-dialog');
    expect(screen.queryByTestId('thing-dialog')).toBeNull();
    fireEvent.click(within(result).getByRole('button', { name: 'Add another' }));
    expect(await screen.findByTestId('thing-dialog')).toBeTruthy();
    expect(screen.queryByTestId('save-result-dialog')).toBeNull();
  });
});

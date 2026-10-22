import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EditorSheet } from './editor-sheet';

describe('EditorSheet (ux-kit: stop policy and unit state editors)', () => {
  it('shows the editor with its title and what saving does only while open', () => {
    const { rerender } = render(
      <EditorSheet open={false} onOpenChange={() => undefined} title="Record new version" description="Applies from the date you choose.">
        <p>Editor body</p>
      </EditorSheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <EditorSheet open onOpenChange={() => undefined} title="Record new version" description="Applies from the date you choose.">
        <p>Editor body</p>
      </EditorSheet>,
    );
    const sheet = screen.getByRole('dialog', { name: 'Record new version' });
    expect(within(sheet).getByText('Applies from the date you choose.')).toBeInTheDocument();
    expect(within(sheet).getByText('Editor body')).toBeInTheDocument();
  });

  it('closing asks the page to close it (the draft is dropped)', () => {
    const onOpenChange = vi.fn();
    render(
      <EditorSheet open onOpenChange={onOpenChange} title="New mapping version" description="A draft until approved.">
        <p>Editor body</p>
      </EditorSheet>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

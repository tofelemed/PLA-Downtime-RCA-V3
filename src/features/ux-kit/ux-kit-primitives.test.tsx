import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ActionIcon } from '@/lib/icons';
import { ConfirmDialog } from './confirm-dialog';
import { DebouncedSearchInput } from './debounced-search-input';
import { IconButton } from './icon-button';
import { Page, PageHeader, Section } from './page-layout';

const deferred = () => {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('ConfirmDialog', () => {
  const openDialog = async (onConfirm: () => Promise<unknown>) => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<button type="button">Retire</button>}
        title="Retire this profile?"
        description="Plans keep their history."
        confirmLabel="Retire profile"
        destructive
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Retire' }));
    return user;
  };

  it('focuses Cancel first for destructive actions', async () => {
    await openDialog(async () => undefined);
    expect(screen.getByRole('alertdialog', { name: 'Retire this profile?' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('stays open and busy while the promise runs, and stays open on reject', async () => {
    const call = deferred();
    const user = await openDialog(() => call.promise);
    await user.click(screen.getByRole('button', { name: 'Retire profile' }));
    expect(screen.getByRole('button', { name: 'Retire profile' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => {
      call.reject(new Error('refused'));
      await call.promise.catch(() => undefined);
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retire profile' })).toBeEnabled();
  });

  it('is 420 px wide by default (confirm size) and 560 px with size="md"', async () => {
    const view = render(<ConfirmDialog open onOpenChange={() => undefined} title="Retire?" confirmLabel="Retire" onConfirm={() => undefined} />);
    expect(screen.getByRole('alertdialog').className).toContain('sm:max-w-[420px]');
    view.unmount();
    render(<ConfirmDialog open size="md" onOpenChange={() => undefined} title="Approve?" confirmLabel="Approve" onConfirm={() => undefined} />);
    expect(screen.getByRole('alertdialog').className).toContain('sm:max-w-[560px]');
  });

  it('focuses the initialFocus element on open, even for destructive actions', async () => {
    function WithReason() {
      const field = useRef<HTMLTextAreaElement>(null);
      return (
        <ConfirmDialog open onOpenChange={() => undefined} title="Cancel it?" confirmLabel="Cancel action" destructive initialFocus={field} onConfirm={() => undefined}>
          <textarea ref={field} aria-label="Reason" />
        </ConfirmDialog>
      );
    }
    render(<WithReason />);
    await waitFor(() => expect(screen.getByLabelText('Reason')).toHaveFocus());
  });

  it('closes when the promise resolves', async () => {
    const call = deferred();
    const user = await openDialog(() => call.promise);
    await user.click(screen.getByRole('button', { name: 'Retire profile' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await act(async () => {
      call.resolve();
      await call.promise;
    });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});

describe('IconButton', () => {
  it('uses the label as the accessible name and hides the icon', async () => {
    const onClick = vi.fn();
    render(<IconButton icon={ActionIcon.edit} label="Edit unit" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Edit unit' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Page layout', () => {
  afterEach(() => {
    document.title = 'Traverse Forge';
  });

  it('PageHeader renders the single h1 and sets the document title, restoring it on unmount', () => {
    document.title = 'Before';
    const view = render(
      <MemoryRouter>
        <Page width="wide">
          <PageHeader title="Production plans" description="Plans per unit" back={{ to: '/planning', label: 'Planning' }} actions={<button type="button">New plan</button>} />
          <Section title="Active plans">rows</Section>
        </Page>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Production plans' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Planning' })).toHaveAttribute('href', '/planning');
    expect(screen.getByRole('region', { name: 'Active plans' })).toBeInTheDocument();
    expect(document.title).toBe('Production plans · Traverse Forge');
    view.unmount();
    expect(document.title).toBe('Before');
  });

  const withoutIds = (html: string) => html.replace(/:r[0-9a-z]+:/g, ':id:');

  it('Section.titleAside renders next to the heading; without it the output is unchanged', () => {
    const plain = render(<Section title="Details">rows</Section>);
    const plainHtml = withoutIds(plain.container.innerHTML);
    plain.unmount();
    const withAside = render(<Section title="Details" titleAside={<button type="button">About details</button>}>rows</Section>);
    const heading = screen.getByRole('heading', { level: 2, name: 'Details' });
    expect(heading.nextElementSibling).toBe(screen.getByRole('button', { name: 'About details' }));
    expect(withoutIds(withAside.container.innerHTML)).not.toBe(plainHtml);
    withAside.unmount();
    const again = render(<Section title="Details">rows</Section>);
    expect(withoutIds(again.container.innerHTML)).toBe(plainHtml);
    expect(screen.queryByRole('button', { name: 'About details' })).toBeNull();
  });

  it('a collapsible Section is a disclosure with aria-expanded', async () => {
    const user = userEvent.setup();
    render(
      <Section title="Details" collapsible defaultOpen={false} headingLevel={3}>
        <p>Run provenance</p>
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: 'Details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Run provenance')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Run provenance')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Details' })).toBeInTheDocument();
  });
});

describe('DebouncedSearchInput', () => {
  afterEach(() => vi.useRealTimers());

  it('emits once, 300 ms after typing stops, and clears with Escape', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<DebouncedSearchInput label="Search events" value="" onChange={onChange} />);
    const input = screen.getByRole('searchbox', { name: 'Search events' });
    fireEvent.change(input, { target: { value: 'p' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: 'pu' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: 'pump' } });
    act(() => vi.advanceTimersByTime(299));
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('pump');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    act(() => vi.advanceTimersByTime(500));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('follows the value when it changes from outside without echoing it back', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const view = render(<DebouncedSearchInput label="Search" value="pump" onChange={onChange} />);
    view.rerender(<DebouncedSearchInput label="Search" value="" onChange={onChange} />);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    act(() => vi.advanceTimersByTime(500));
    expect(onChange).not.toHaveBeenCalled();
  });
});

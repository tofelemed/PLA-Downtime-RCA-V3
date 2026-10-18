import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartFigure } from './chart-figure';
import { ConfirmDialog } from './confirm-dialog';
import { FormField } from './form-field';

describe('FormField (C-8)', () => {
  it('labels the control and marks it required: visible "*" hidden from AT, "required" for AT', () => {
    render(
      <FormField id="name" label="Name" required hint="As shown on reports">
        <input id="name" />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: /Name/ });
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('required')).toHaveClass('sr-only');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'name-hint');
    expect(input).toHaveAccessibleDescription('As shown on reports');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('wires the error with aria-describedby and aria-invalid, replacing the hint and keeping own ids', () => {
    render(
      <>
        <p id="extra">Extra help</p>
        <FormField id="qty" label="Quantity" hint="Whole units" error="Enter a number">
          <input id="qty" aria-describedby="extra" />
        </FormField>
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Quantity' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'extra qty-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number');
    expect(screen.getByTestId('field-error-qty')).toHaveAttribute('id', 'qty-error');
    expect(screen.queryByText('Whole units')).not.toBeInTheDocument();
  });

  it('leaves a composite child alone (no matching id) and does not duplicate a native required', () => {
    render(
      <>
        <FormField id="a" label="Composite">
          <div data-testid="wrapper">
            <input id="a" />
          </div>
        </FormField>
        <FormField id="b" label="Native" required>
          <input id="b" required />
        </FormField>
      </>,
    );
    expect(screen.getByTestId('wrapper')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('textbox', { name: /Native/ })).not.toHaveAttribute('aria-required');
  });
});

describe('ChartFigure (H-6)', () => {
  it('is a figure named by its caption, hides the drawing and offers the data as a table', () => {
    render(
      <ChartFigure caption="Stops per day for 3 days." table={<table aria-label="Stops"><tbody><tr><td>Mon</td></tr></tbody></table>}>
        <svg data-testid="drawing" />
      </ChartFigure>,
    );
    expect(screen.getByRole('figure', { name: 'Stops per day for 3 days.' })).toBeInTheDocument();
    expect(screen.getByText('Stops per day for 3 days.')).toHaveClass('sr-only');
    expect(screen.getByTestId('drawing').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('View as table').tagName).toBe('SUMMARY');
  });

  it('can show the caption and has no disclosure without a table', () => {
    render(
      <ChartFigure caption="Visible summary" captionVisible>
        <svg />
      </ChartFigure>,
    );
    expect(screen.getByText('Visible summary')).not.toHaveClass('sr-only');
    expect(screen.queryByText('View as table')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog disabled reason (H-5)', () => {
  it('says why the confirm button is disabled and links it to the button', () => {
    render(<ConfirmDialog open onOpenChange={() => undefined} title="Retract?" confirmLabel="Retract" confirmDisabled confirmDisabledReason="Enter a reason to continue." onConfirm={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Retract' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Enter a reason to continue.');
  });
});

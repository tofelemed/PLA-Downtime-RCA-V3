import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { V2ApiError, type FieldError } from '@/api/v2/errors';
import { ApiError } from '@/services/api/httpClient';
import { describeError, refusalTitle } from './describe-error';
import { ERROR_MESSAGES } from './error-messages';
import { fieldLabel } from './field-label';
import { FriendlyErrorAlert } from './friendly-error-alert';
import { friendlyToastContent } from './friendly-toast';
import { SupportReference } from './support-reference';

const CORR = '7e1d2c3b-1234-4abc-8def-0123456789ab';
const v2 = (status: number, code: string, message: string, fieldErrors: FieldError[] = []) =>
  new V2ApiError(status, { code, message, fieldErrors, correlationId: CORR, retryable: false });

function expectNothingInternal(text: string) {
  expect(text).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
  expect(text).not.toContain(CORR);
  expect(text).not.toMatch(/\b\d{3}\b/);
}

describe('describeError', () => {
  it('a known code: mapped title and text; code, status and correlation id only in the reference', () => {
    const friendly = describeError(v2(422, 'UOM_MIXED', 'UOM_MIXED'));
    expect(friendly.title).toBe('Different units of measure cannot be added up');
    expect(friendly.message).toBe(ERROR_MESSAGES.UOM_MIXED.text);
    expect(friendly.reference).toEqual({ code: 'UOM_MIXED', status: 422, correlationId: CORR });
    expectNothingInternal(`${friendly.title} ${friendly.message}`);
  });

  it('a start or end in the future asks for a time up to now (DT-09)', () => {
    const friendly = describeError(
      v2(422, 'IN_FUTURE', 'endTime must not be in the future', [{ field: 'endTime', message: 'endTime must not be in the future' }]),
    );
    expect(friendly.title).toBe('The time is in the future');
    expectNothingInternal(`${friendly.title} ${friendly.message}`);
  });

  it('an RCA case that cannot close yet says what is missing (RCA-01)', () => {
    const friendly = describeError(
      v2(422, 'CLOSE_BLOCKED', 'finish every action before closing the case', [
        { field: 'actions', message: 'finish every action (done, or cancelled with a reason) before closing the case' },
      ]),
    );
    expect(friendly.title).toBe('This case cannot be closed yet');
    expectNothingInternal(`${friendly.title} ${friendly.message}`);
  });

  it('an unknown code with a sentence: status-class title and the server sentence', () => {
    const friendly = describeError(v2(409, 'BRAND_NEW_RULE', 'the shift is already closed'));
    expect(friendly.title).toBe('This was changed by someone else');
    expect(friendly.message).toBe('The shift is already closed');
  });

  it('an unknown code whose message is the code, or a generated / id-bearing message: fallback text', () => {
    expect(describeError(v2(422, 'WEIRD_CODE', 'WEIRD_CODE')).message).toBe('Check the highlighted values and try again.');
    expect(describeError(v2(404, 'HTTP_404', 'Request failed with status 404')).title).toBe('Not found');
    expect(describeError(v2(400, 'X_Y', `plan ${CORR} is locked`)).message).not.toContain(CORR);
    expect(describeError(v2(400, 'X_Y', 'uses oee_policy@3 already')).message).toBe('Check the highlighted values and try again.');
  });

  it('a 5xx never shows the server text', () => {
    const friendly = describeError(v2(500, 'INTERNAL_ERROR', 'relation "x" does not exist'));
    expect(friendly.title).toBe('The server could not complete the request');
    expect(friendly.message).toBe('Try again. If it keeps happening, contact support.');
    expect(describeError(v2(502, 'SOMETHING', 'Bad gateway')).title).toBe('The server could not complete the request');
  });

  it('a network TypeError: cannot reach the server, no reference', () => {
    const friendly = describeError(new TypeError('Failed to fetch'));
    expect(friendly.title).toBe('Cannot reach the server');
    expect(friendly.reference).toBeNull();
  });

  it('a v1 ApiError: envelope code, legacy validation list as field messages', () => {
    const body = { code: 'VALIDATION_FAILED', message: ['property foo should not exist', 'quantity must be a positive number'], correlationId: CORR };
    const friendly = describeError(new ApiError(400, 'Bad Request', '/api/x', body));
    expect(friendly.title).toBe('Some values were not accepted');
    expect(friendly.fieldMessages).toEqual([
      { label: 'Foo', message: 'Is not accepted here' },
      { label: 'Quantity', message: 'Must be a positive number' },
    ]);
    expect(friendly.reference?.correlationId).toBe(CORR);
    const bare = describeError(new ApiError(403, 'Forbidden', '/api/users'));
    expect(bare.title).toBe("You don't have permission for this");
    expect(bare.message).not.toContain('403');
  });

  it('field errors get plain labels', () => {
    const friendly = describeError(v2(422, 'VALIDATION_FAILED', 'Validation failed', [{ field: 'lines[0].quantity', message: 'must be positive' }]));
    expect(friendly.fieldMessages).toEqual([{ label: 'Line 1 · Quantity', message: 'Must be positive' }]);
  });

  it('plain errors and unknown values', () => {
    expect(describeError(new Error('Choose a unit first')).message).toBe('Choose a unit first');
    expect(describeError(new ReferenceError('x is not defined')).message).toBe('Try again. If it keeps happening, contact support.');
    expect(describeError(undefined).title).toBe('Something went wrong');
    expect(describeError({ weird: true }).reference).toBeNull();
  });

  it('refusalTitle and toast content', () => {
    expect(refusalTitle('SEPARATION_OF_DUTIES', 409)).toBe('Someone else must approve this');
    expect(refusalTitle('UNKNOWN', 412)).toBe('This record changed since you opened it');
    expect(refusalTitle(null, 429)).toBe('Too many requests');
    const toast = friendlyToastContent(v2(422, 'VALIDATION_FAILED', 'x', [{ field: 'validFrom', message: 'must be a date' }]));
    expect(toast).toEqual({ title: 'Some values were not accepted', description: 'Check the highlighted values and try again. Valid from: Must be a date.' });
  });

  it('every mapped message is plain language', () => {
    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      expect(message.title, code).not.toContain(code);
      expect(`${message.title} ${message.text ?? ''}`, code).not.toMatch(/[A-Z]{2,}_[A-Z]/);
    }
  });
});

describe('fieldLabel', () => {
  it('turns server paths into labels', () => {
    expect(fieldLabel('lines[0].quantity')).toBe('Line 1 · Quantity');
    expect(fieldLabel('slices.2.unitId')).toBe('Slice 3 · Unit');
    expect(fieldLabel('validFrom')).toBe('Valid from');
    expect(fieldLabel('entries[1].productId')).toBe('Entry 2 · Product');
    expect(fieldLabel('')).toBe('');
  });
});

describe('SupportReference and FriendlyErrorAlert', () => {
  afterEach(() => vi.unstubAllGlobals());
  const reference = { code: 'UOM_MIXED', status: 422, correlationId: CORR };

  it('copies the reference without showing it', async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { container } = render(<SupportReference reference={reference} />);
    expect(container.textContent).not.toContain(CORR);
    fireEvent.click(screen.getByRole('button', { name: 'Copy support reference' }));
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());
    expect(writeText.mock.calls[0][0]).toMatch(new RegExp(`^Pro-Act support reference: code=UOM_MIXED status=422 ref=${CORR} at=\\d{4}-`));
  });

  it('falls back to a selected read-only field when the clipboard is refused', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
    render(<SupportReference reference={reference} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy support reference' }));
    const field = await screen.findByLabelText('Support reference (copy it manually)');
    expect((field as HTMLInputElement).readOnly).toBe(true);
  });

  it('renders nothing without a code or correlation id', () => {
    const { container } = render(<SupportReference reference={{ code: null, status: 500, correlationId: null }} />);
    expect(container.innerHTML).toBe('');
  });

  it('the alert shows title, message, field messages and retry; the code is only an attribute', () => {
    const onRetry = vi.fn();
    const error = v2(422, 'CODE_HAS_CHILDREN', 'CODE_HAS_CHILDREN', [{ field: 'parentId', message: 'has children' }]);
    const { container } = render(<FriendlyErrorAlert error={error} onRetry={onRetry} />);
    expect(screen.getByText('This code has sub-codes')).toBeInTheDocument();
    expect(screen.getByText('Move or retire its sub-codes first.')).toBeInTheDocument();
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(container.querySelector('[data-code="CODE_HAS_CHILDREN"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/CODE_HAS_CHILDREN|422/);
    expect(container.textContent).not.toContain(CORR);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

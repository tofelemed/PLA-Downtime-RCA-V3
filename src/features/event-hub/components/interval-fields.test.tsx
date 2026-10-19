import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EMPTY_FORM, END_BEFORE_START_MESSAGE } from '../model/event-form';
import { EventHubEnvContext, type EventHubEnv } from '../use-event-hub-env';
import { IntervalFields } from './interval-fields';

const ENV: EventHubEnv = {
  tenantId: 't1', timezone: 'Asia/Tehran', timezoneIsFallback: false, units: [], unitsLoading: false, reasonCodes: [], allReasonCodes: [],
  unitName: () => 'Unit 1', reasonName: () => '—',
};

function renderFields(startLocal: string, endLocal: string, endError?: string) {
  const form = { values: { ...EMPTY_FORM, startLocal, endLocal }, errors: endError ? { endLocal: endError } : {}, setField: vi.fn() };
  return render(
    <EventHubEnvContext.Provider value={ENV}>
      <IntervalFields form={form} mode="create" />
    </EventHubEnvContext.Provider>,
  );
}

describe('IntervalFields: end after start (QA audit F3)', () => {
  it('says at the End field, while typing, that an end before the start is not accepted', () => {
    renderFields('2026-10-19T12:21', '2026-10-01T08:00');
    expect(screen.getByTestId('error-endLocal')).toHaveTextContent(END_BEFORE_START_MESSAGE);
  });

  it('shows nothing for an end after the start, and the server message when there is one', () => {
    const { unmount } = renderFields('2026-10-19T08:00', '2026-10-19T09:00');
    expect(screen.queryByTestId('error-endLocal')).toBeNull();
    unmount();
    renderFields('2026-10-19T08:00', '2026-10-19T07:00', 'endTime must be after startTime');
    expect(screen.getByTestId('error-endLocal')).toHaveTextContent('endTime must be after startTime');
  });
});

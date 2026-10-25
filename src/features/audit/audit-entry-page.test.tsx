import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/admin/shared/use-plant-dates', () => ({ usePlantDates: () => ({ dateTime: () => '2026-10-25 09:30' }) }));
vi.mock('@/api/v2/queries/administration-audit', () => ({
  useAuditEntry: () => ({
    data: {
      id: 'e1',
      timestamp: '2026-10-25T06:00:00.000Z',
      actorId: 'u1',
      actorName: 'Reza',
      action: 'UPDATE',
      entityType: 'unit',
      entityId: '7f3c2a10-0000-4000-8000-000000000001',
      message: 'Renamed the unit',
      details: '{"before":{"name":"A"},"after":{"name":"B"}}',
    },
  }),
}));

const { AuditEntryPage } = await import('./audit-entry-page');

describe('Audit entry page', () => {
  it('shows the entry in plain terms, without record ids or the raw payload', () => {
    actAs('SuperAdmin');
    render(
      <MemoryRouter initialEntries={['/audit/e1']}>
        <Routes>
          <Route path="/audit/:entryId" element={<AuditEntryPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Renamed the unit')).toBeInTheDocument();
    expect(screen.getByText('Reza')).toBeInTheDocument();
    expect(screen.queryByText('Technical details')).toBeNull();
    expect(screen.queryByText('Record reference')).toBeNull();
    expect(screen.queryByText('7f3c2a10-0000-4000-8000-000000000001')).toBeNull();
    expect(screen.queryByText(/"before"/)).toBeNull();
  });
});

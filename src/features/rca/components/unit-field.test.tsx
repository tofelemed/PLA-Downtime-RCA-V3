import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { UnitField } = await import('./unit-field');

describe('UnitField', () => {
  it('is disabled until the units load, then shows the unit of the URL', async () => {
    actAs('SuperAdmin', 'u-1');
    stubV2Fetch(() => jsonResponse(200, listPage([{ id: 'u1', code: 'EXT', name: 'Extruder' }])));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UnitField id="unit" value="u1" onChange={vi.fn()} />
      </QueryClientProvider>,
    );
    const select = screen.getByLabelText('Unit');
    expect(select).toBeDisabled();
    await waitFor(() => expect(select).toBeEnabled());
    expect(select).toHaveValue('u1');
  });
});

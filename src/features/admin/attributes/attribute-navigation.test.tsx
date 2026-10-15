import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AttributeDefinitionView } from '@/api/v2/types/administration';
import { AttributeFormPage } from './attribute-form-page';

const mock = vi.hoisted(() => ({ definition: undefined as AttributeDefinitionView | undefined }));
vi.mock('@/features/auth/use-capabilities', () => ({ useCapabilities: () => ({ canUseAdminPanel: true, canManageMasterData: true }) }));
vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'plant-1' }));
vi.mock('@/api/v2/queries/administration-config', () => ({
  useAttributeDefinition: () => ({ data: mock.definition }),
  useCreateAttribute: () => ({ submit: vi.fn() }),
  useUpdateAttribute: () => ({ submit: vi.fn() }),
  useDeleteAttribute: () => ({ submit: vi.fn() }),
}));

function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname}{location.search}</output>;
}

function open(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/attributes/new" element={<AttributeFormPage />} />
        <Route path="/admin/attributes/:attributeId" element={<AttributeFormPage />} />
        <Route path="/admin" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('attribute return navigation', () => {
  beforeEach(() => {
    mock.definition = undefined;
    vi.stubGlobal('ResizeObserver', class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['Asset', 'Organization', 'Tenant', 'Unit'])('returns a new %s attribute to its original level', (level) => {
    open(`/admin/attributes/new?level=${level}`);
    expect(screen.getByRole('link', { name: 'Admin panel' }).getAttribute('href')).toBe(`/admin?tab=attributes&level=${level}`);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('destination').textContent).toBe(`/admin?tab=attributes&level=${level}`);
  });

  it('uses the stored level for a direct edit link', () => {
    mock.definition = {
      id: 'attribute-1', entityType: 'Asset', name: 'grade', displayName: 'Grade', description: null, dataType: 'string',
      isRequired: false, defaultValue: null, validationRules: { minLength: null, maxLength: null, minValue: null, maxValue: null, pattern: null },
      selectOptions: [], displayOrder: 1, isActive: true, scope: 'plant', editable: true,
      createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    };
    open('/admin/attributes/attribute-1');
    fireEvent.click(screen.getByRole('link', { name: 'Admin panel' }));
    expect(screen.getByTestId('destination').textContent).toBe('/admin?tab=attributes&level=Asset');
  });

  it('falls back to Units for an unrecognized level', () => {
    open('/admin/attributes/new?level=not-a-level');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('destination').textContent).toBe('/admin?tab=attributes&level=Unit');
  });
});

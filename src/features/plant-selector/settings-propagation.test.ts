import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateForChange, PLANT_SETTINGS } from '@/api/v2/queries/invalidation';
import { v2Keys } from '@/api/v2/queries/query-keys';
import type { DirectoryOrganization, DirectoryPlant } from '@/api/v2/types/plant-directory';
import { refreshedSelection } from './selection-refresh';
import { plantDirectoryKeys } from './use-plant-directory';

const org = { id: 'org-1', name: 'Marun Petrochemical' } as DirectoryOrganization;
const plant = { id: 'plant-1', name: 'HDPE', organizationId: 'org-1', timezone: 'Asia/Tehran' } as DirectoryPlant;

describe('plant settings reach every user (settings audit, 21 Oct 2026)', () => {
  it('refreshes a stored selection after another administrator renamed the plant or organisation', () => {
    const stored = { organization: org, tenant: plant };
    const renamed = refreshedSelection(stored, [{ ...plant, name: 'HDPE Train 1' }], [{ ...org, name: 'Marun Co.' }]);
    expect(renamed?.tenant?.name).toBe('HDPE Train 1');
    expect(renamed?.organization?.name).toBe('Marun Co.');
    expect(refreshedSelection(stored, [plant], [org])).toBeNull();
    expect(refreshedSelection(null, [plant], [org])).toBeNull();
  });

  it('a plant settings notice refetches every query of the plant and the plant directory', async () => {
    const client = new QueryClient();
    client.setQueryData(v2Keys.resource('plant-1', 'reports'), {});
    client.setQueryData(plantDirectoryKeys.tenants('u1'), []);
    client.setQueryData(v2Keys.resource('plant-2', 'reports'), {});
    await invalidateForChange(client, { tenantId: 'plant-1', entityType: PLANT_SETTINGS });
    const invalid = client
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.isInvalidated)
      .map((query) => JSON.stringify(query.queryKey));
    expect(invalid).toContain(JSON.stringify(v2Keys.resource('plant-1', 'reports')));
    expect(invalid).toContain(JSON.stringify(plantDirectoryKeys.tenants('u1')));
    expect(invalid).not.toContain(JSON.stringify(v2Keys.resource('plant-2', 'reports')));
  });
});

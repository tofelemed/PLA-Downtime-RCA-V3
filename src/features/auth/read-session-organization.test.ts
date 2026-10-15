import { beforeEach, describe, expect, it, vi } from 'vitest';
import { v2Request } from '@/api/v2/client';
import { readSessionOrganization } from './read-session-organization';

vi.mock('@/api/v2/client', () => ({ v2Request: vi.fn() }));
const request = vi.mocked(v2Request);
const page = (items: Array<{ id: string; name: string; code: string }>, nextCursor: string | null = null) =>
  ({ data: { items, nextCursor }, status: 200, etag: null, correlationId: 'test' });

describe('session organization directory', () => {
  beforeEach(() => request.mockReset());

  it('finds the home organization beyond the first page and keeps the home tenant header', async () => {
    const organization = { id: 'org-2', name: 'Demo Org', code: 'demo' };
    request.mockResolvedValueOnce(page([{ id: 'org-1', name: 'Another', code: 'other' }], 'next'));
    request.mockResolvedValueOnce(page([organization]));
    expect(await readSessionOrganization('org-2', 'home-plant')).toEqual(organization);
    expect(request).toHaveBeenNthCalledWith(2, {
      method: 'GET', path: '/organizations', tenantId: 'home-plant', query: { limit: 100, cursor: 'next' },
    });
  });

  it('does not substitute an unrelated organization when the session organization is absent', async () => {
    request.mockResolvedValueOnce(page([{ id: 'other', name: 'Other', code: 'other' }]));
    await expect(readSessionOrganization('missing', 'home-plant')).rejects.toThrow('not accessible');
  });

  it('stops a broken pagination loop', async () => {
    request.mockResolvedValue(page([], 'repeated'));
    await expect(readSessionOrganization('missing')).rejects.toThrow('repeated cursor');
    expect(request).toHaveBeenCalledTimes(2);
  });
});

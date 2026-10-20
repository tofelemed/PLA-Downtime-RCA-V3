import {
  anonymousContext,
  RequestContext,
} from '../../common/context/request-context';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BrandingV2Service } from '../administration/branding/branding-v2.service';
import { HierarchyEditV2Service } from '../administration/hierarchy/hierarchy-edit-v2.service';
import { HierarchyV2Service } from '../administration/hierarchy/hierarchy-v2.service';
import { CalendarsV2Service } from '../calendars/calendars-v2.service';
import { SessionBootstrapV2Service } from './session-bootstrap-v2.service';

const TENANT = '433c1a69-7a32-4b32-ab20-c4139423abd2';
const context: RequestContext = {
  ...anonymousContext('test'),
  userId: 'user-1',
  tenantId: TENANT,
};

function services() {
  const page = <T>(items: T[], nextCursor: string | null) => ({
    items,
    nextCursor,
  });
  const listOrganizations = jest
    .fn()
    .mockResolvedValueOnce(page([{ id: 'o1' }], 'c1'))
    .mockResolvedValueOnce(page([{ id: 'o2' }], null));
  const listPlants = jest.fn().mockResolvedValue(page([{ id: TENANT }], null));
  const listSites = jest.fn().mockResolvedValue(page([{ id: 's1' }], null));
  const getPlant = jest.fn().mockResolvedValue({ id: TENANT, name: 'HDPE' });
  const service = new SessionBootstrapV2Service(
    {
      get: jest.fn().mockResolvedValue({ appName: 'Pro-Act' }),
    } as unknown as BrandingV2Service,
    {
      list: jest.fn().mockResolvedValue([{ key: 'v2.x', enabled: true }]),
    } as unknown as FeatureFlagsService,
    {
      unreadCount: jest.fn().mockResolvedValue(3),
    } as unknown as NotificationsService,
    { listSites } as unknown as CalendarsV2Service,
    { listOrganizations, listPlants } as unknown as HierarchyV2Service,
    { getPlant } as unknown as HierarchyEditV2Service,
  );
  return { service, listOrganizations, listPlants, listSites, getPlant };
}

describe('SessionBootstrapV2Service (perf audit P08)', () => {
  it('returns each shell part as the body of the endpoint it replaces', async () => {
    const { service, listSites, getPlant } = services();
    const view = await service.bootstrap(context);
    expect(view.branding).toEqual({ appName: 'Pro-Act' });
    expect(view.featureFlags).toMatchObject({
      items: [{ key: 'v2.x', enabled: true }],
      scope: { tenantId: TENANT },
    });
    expect(view.unreadNotifications).toEqual({ unread: 3 });
    expect(view.sites.items).toEqual([{ id: 's1' }]);
    expect(listSites).toHaveBeenCalledWith(context, { limit: 100 });
    expect(view.plant).toEqual({ id: TENANT, name: 'HDPE' });
    expect(getPlant).toHaveBeenCalledWith(context, TENANT);
  });

  it('reads every page of the plant directory', async () => {
    const { service, listOrganizations } = services();
    const view = await service.bootstrap(context);
    expect(view.directory.organizations).toEqual([{ id: 'o1' }, { id: 'o2' }]);
    expect(view.directory.plants).toEqual([{ id: TENANT }]);
    expect(listOrganizations).toHaveBeenNthCalledWith(2, context, {
      limit: 500,
      cursor: 'c1',
    });
  });

  it('needs an acting tenant like every tenant-scoped shell read', async () => {
    const { service } = services();
    await expect(
      service.bootstrap({ ...context, tenantId: null }),
    ).rejects.toThrow();
  });
});

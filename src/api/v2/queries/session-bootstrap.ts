import { v2Request } from '../client';
import { v2Session } from '../config';
import type { BrandingView, PlantView } from '../types/administration';
import type { ListResponse } from '../types/envelopes';
import type { FeatureFlagsView, SiteView } from '../types/flags';
import type { DirectoryOrganization, DirectoryPlant } from '../types/plant-directory';

/** `GET /v2/session/bootstrap`: each part is the body of the endpoint the shell would call for it. */
export interface SessionBootstrap {
  branding: BrandingView;
  featureFlags: FeatureFlagsView;
  unreadNotifications: { unread: number };
  sites: ListResponse<SiteView>;
  plant: PlantView;
  directory: { organizations: DirectoryOrganization[]; plants: DirectoryPlant[] };
}

/** What each shell query takes from the bootstrap. */
const PARTS = {
  branding: (b: SessionBootstrap) => b.branding,
  featureFlags: (b: SessionBootstrap) => b.featureFlags,
  unreadNotifications: (b: SessionBootstrap) => b.unreadNotifications,
  sites: (b: SessionBootstrap) => b.sites,
  plant: (b: SessionBootstrap) => b.plant,
  organizations: (b: SessionBootstrap) => b.directory.organizations,
  plants: (b: SessionBootstrap) => b.directory.plants,
} as const;
export type BootstrapPart = keyof typeof PARTS;
type PartData<P extends BootstrapPart> = ReturnType<(typeof PARTS)[P]>;

/** A shell query uses the bootstrap only for its first load; refetches go to its own endpoint. */
const FIRST_LOAD_WINDOW_MS = 30_000;

interface Batch {
  owner: string;
  startedAt: number;
  response: Promise<SessionBootstrap | null>;
  served: Set<BootstrapPart>;
}

let batch: Batch | null = null;

function startBatch(owner: string): Batch {
  return {
    owner,
    startedAt: Date.now(),
    // shared by every shell query of the page: never cancelled by one of them; a failure means "fetch alone"
    response: v2Request<SessionBootstrap>({ method: 'GET', path: '/session/bootstrap' })
      .then((res) => res.data)
      .catch(() => null),
    served: new Set(),
  };
}

/**
 * Batched shell reads (perf audit P08): the shell queries that mount together on page load share one
 * `GET /v2/session/bootstrap` instead of ~7 requests. Each query takes its part once, within 30 s of the
 * batch; any later fetch (stale data, invalidation, refocus), another session or tenant, or a failed batch
 * falls back to `fetchAlone`, the query's own endpoint.
 */
export async function fromSessionBootstrap<P extends BootstrapPart>(
  part: P,
  fetchAlone: () => Promise<PartData<P>>,
): Promise<PartData<P>> {
  const session = v2Session();
  const tenantId = session.getTenantId();
  if (!tenantId) return fetchAlone();
  const owner = `${session.getSessionKey?.() ?? ''}|${tenantId}`;
  if (!batch || batch.owner !== owner) batch = startBatch(owner);
  const current = batch;
  if (current.served.has(part) || Date.now() - current.startedAt > FIRST_LOAD_WINDOW_MS) return fetchAlone();
  current.served.add(part);
  const value = partOf(await current.response, part);
  return value === undefined ? fetchAlone() : value;
}

/** The part, or undefined when the response lacks it (failed batch, older server, unexpected body). */
function partOf<P extends BootstrapPart>(response: SessionBootstrap | null, part: P): PartData<P> | undefined {
  if (!response || typeof response !== 'object') return undefined;
  try {
    return (PARTS[part](response) ?? undefined) as PartData<P> | undefined;
  } catch {
    return undefined;
  }
}

/** Test seam: forget the current batch. */
export function resetSessionBootstrap(): void {
  batch = null;
}

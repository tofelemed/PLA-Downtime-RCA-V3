import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureV2Session } from '@/api/v2/config';
import { brandingService } from './BrandingService';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('brandingService (GET /v2/branding, no in-memory cache)', () => {
  let reply: () => Response;
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => reply()));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the stored branding over the defaults and applies it to the document', async () => {
    reply = () => json(200, { appName: 'Acme Ops', appSubtitle: null, logoInitials: 'AO', isStored: true, updatedAt: '2026-10-12T00:00:00Z' });
    const branding = await brandingService.getBranding();
    expect(branding).toMatchObject({ appName: 'Acme Ops', logoInitials: 'AO', logoObjectFit: 'contain', updatedAt: '2026-10-12T00:00:00Z' });
    expect(branding.appSubtitle).toBe(brandingService.getDefaultBranding().appSubtitle);
    expect(document.title).toContain('Acme Ops');
  });

  it('a second read after a change returns the new branding (no reload needed)', async () => {
    reply = () => json(200, { appName: 'First', isStored: true, updatedAt: null });
    expect((await brandingService.getBranding()).appName).toBe('First');
    reply = () => json(200, { appName: 'Second', isStored: true, updatedAt: null });
    expect((await brandingService.getBranding()).appName).toBe('Second');
  });

  it('falls back to the defaults when the request fails', async () => {
    reply = () => json(500, { code: 'INTERNAL', message: 'x', correlationId: 'c', retryable: false });
    expect((await brandingService.getBranding()).appName).toBe(brandingService.getDefaultBranding().appName);
  });
});

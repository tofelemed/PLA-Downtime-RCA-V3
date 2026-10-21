import { SetMetadata } from '@nestjs/common';

export const CLIENT_AUDITED_KEY = 'clientAudited';

/**
 * A route whose callers may write their own audit entry and send `X-Client-Audited: true` to skip the
 * automatic one. On every other route the header is ignored, so a caller cannot switch the audit off
 * (settings audit, 21 Oct 2026).
 */
export const ClientAudited = () => SetMetadata(CLIENT_AUDITED_KEY, true);

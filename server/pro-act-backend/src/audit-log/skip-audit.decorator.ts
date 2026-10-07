import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'skipAudit';

/** Opt out of server-side auto-audit for a handler (e.g. high-frequency or internal). */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

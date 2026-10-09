import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { RequestContext } from '../common/context/request-context';
import { RequestContextFactory } from '../auth/context/request-context.factory';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

/** Credentials a socket presents in its handshake `auth` object (never in the query string). */
export interface RealtimeCredentials {
  token: string;
  /** SuperAdmin / multi-tenant selection, validated like the `X-Tenant-Id` header */
  tenantId?: string;
}

export interface RealtimeSession {
  credentials: RealtimeCredentials;
  context: RequestContext;
  /** token expiry, epoch milliseconds (null when the token carries none) */
  expiresAt: number | null;
}

export class RealtimeAuthError extends Error {
  constructor(
    readonly code: 'UNAUTHENTICATED' | 'TENANT_REQUIRED' | 'FORBIDDEN',
  ) {
    super(code);
  }
}

/** Reads the handshake `auth` object without trusting its shape. */
export function credentialsOf(auth: unknown): RealtimeCredentials | null {
  if (typeof auth !== 'object' || auth === null) return null;
  const { token, tenantId } = auth as Record<string, unknown>;
  if (typeof token !== 'string' || token.length === 0) return null;
  return {
    token,
    tenantId: typeof tenantId === 'string' && tenantId ? tenantId : undefined,
  };
}

/**
 * Socket authentication for the scoped realtime channel (plan 3.1): the same JWT and the same
 * `RequestContextFactory` as HTTP requests, so rooms follow `user_scopes` exactly like `scopedQuery()`.
 * Called at connect and again on every `realtime.subscribe` (permission changes re-join rooms).
 */
@Injectable()
export class RealtimeAuthenticator {
  constructor(
    private readonly jwt: JwtService,
    private readonly contexts: RequestContextFactory,
  ) {}

  async authenticate(
    credentials: RealtimeCredentials | null,
  ): Promise<RealtimeSession> {
    if (!credentials) throw new RealtimeAuthError('UNAUTHENTICATED');
    const payload = await this.verify(credentials.token);
    let context: RequestContext;
    try {
      context = await this.contexts.build({
        payload,
        selectedTenant: credentials.tenantId,
        correlationId: randomUUID(),
        method: 'WS',
        path: '/realtime',
      });
    } catch {
      throw new RealtimeAuthError('FORBIDDEN');
    }
    if (!context.tenantId) throw new RealtimeAuthError('TENANT_REQUIRED');
    return {
      credentials,
      context,
      expiresAt: payload.exp ? payload.exp * 1000 : null,
    };
  }

  private async verify(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      if (!payload?.sub) throw new Error('no subject');
      return payload;
    } catch {
      throw new RealtimeAuthError('UNAUTHENTICATED');
    }
  }
}

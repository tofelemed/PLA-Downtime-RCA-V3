import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Rate-limits per authenticated user (verified `sub` of the bearer token) and per IP for anonymous or
 * invalid tokens. Runs before JwtAuthGuard, so it verifies the token itself instead of reading `req.user`.
 */
@Injectable()
export class UserIpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storage, reflector);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const subject = this.verifiedSubject(req.headers);
    if (subject) {
      return `user:${subject}`;
    }
    return `ip:${await super.getTracker(req)}`;
  }

  private verifiedSubject(headers: unknown): string | null {
    const authorization = (headers as Record<string, unknown> | undefined)
      ?.authorization;
    if (
      typeof authorization !== 'string' ||
      !authorization.startsWith('Bearer ')
    ) {
      return null;
    }
    try {
      const payload = this.jwtService.verify<{ sub?: unknown }>(
        authorization.slice(7).trim(),
      );
      return typeof payload.sub === 'string' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}

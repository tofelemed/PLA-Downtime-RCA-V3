import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, IsNull, LessThan, Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { RefreshTokenRecord } from './refresh-token.entity';
import { loadTokenConfig, TokenConfig } from './token-config';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** access token lifetime in seconds */
  expiresIn: number;
}

interface RefreshClaims {
  sub: string;
  typ: 'refresh';
  jti: string;
  fam: string;
}

type RotationOutcome =
  | { kind: 'rotate'; userId: string; familyId: string }
  | { kind: 'denied'; code: string };

/** Retained after expiry so a late replay is still recognised as reuse rather than as unknown. */
const PURGE_AFTER_EXPIRY_MS = 24 * 60 * 60 * 1000;

function denied(code: string): UnauthorizedException {
  return new UnauthorizedException({ code, message: 'Invalid refresh token' });
}

/**
 * Access and refresh tokens (plan 3.11, D15 JWT hardening): access tokens are short-lived and carry
 * `typ: access`; refresh tokens are signed with a separate key, carry `typ: refresh`, a `jti` and a
 * sign-in family, and are single-use. Spending one issues the next pair; spending one twice (outside a
 * short grace window for parallel tabs) revokes the whole family, as does logout.
 */
@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);
  private readonly config: TokenConfig = loadTokenConfig();

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(RefreshTokenRecord)
    private readonly records: Repository<RefreshTokenRecord>,
  ) {
    if (this.config.refreshSecretDerived) {
      this.logger.warn(
        'JWT_REFRESH_SECRET is not set (or equals JWT_SECRET); refresh tokens use a key derived from JWT_SECRET',
      );
    }
  }

  get accessTtlSeconds(): number {
    return this.config.accessTtlSeconds;
  }

  /** Signs an access token and starts (or continues) a refresh family. */
  async issue(
    user: User,
    familyId: string = randomUUID(),
  ): Promise<IssuedTokens> {
    return this.issueWith(this.records.manager, user, familyId);
  }

  /** Spends a refresh token and returns the next pair of its family; 401 on anything suspicious. */
  async rotate(
    refreshToken: string,
    loadUser: (id: string) => Promise<User | undefined>,
  ): Promise<IssuedTokens> {
    const claims = await this.verify(refreshToken);
    const outcome = await this.records.manager.transaction((manager) =>
      this.spend(manager, claims),
    );
    if (outcome.kind === 'denied') throw denied(outcome.code);
    const user = await loadUser(outcome.userId);
    if (!user || !user.isActive) {
      await this.revokeFamily(
        this.records.manager,
        outcome.familyId,
        'user_inactive',
      );
      throw denied('USER_INACTIVE');
    }
    return this.issue(user, outcome.familyId);
  }

  /** Logout: revokes the family of a valid refresh token; an invalid token is ignored (idempotent). */
  async revoke(refreshToken: string): Promise<boolean> {
    let claims: RefreshClaims;
    try {
      claims = await this.verify(refreshToken, true);
    } catch {
      return false;
    }
    return (
      (await this.revokeFamily(this.records.manager, claims.fam, 'logout')) > 0
    );
  }

  /** Deletes records whose token expired more than a day ago; returns the count. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const result = await this.records.delete({
      expiresAt: LessThan(new Date(now.getTime() - PURGE_AFTER_EXPIRY_MS)),
    });
    return result.affected ?? 0;
  }

  private async issueWith(
    manager: EntityManager,
    user: User,
    familyId: string,
  ): Promise<IssuedTokens> {
    const { accessTtlSeconds, refreshTtlSeconds, refreshSecret } = this.config;
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        organizationId: user.organizationId,
        typ: 'access',
      },
      { expiresIn: accessTtlSeconds },
    );
    const jti = randomUUID();
    const claims: RefreshClaims = {
      sub: user.id,
      typ: 'refresh',
      jti,
      fam: familyId,
    };
    const refreshToken = await this.jwt.signAsync(claims, {
      secret: refreshSecret,
      expiresIn: refreshTtlSeconds,
    });
    await manager.insert(RefreshTokenRecord, {
      id: jti,
      userId: user.id,
      familyId,
      expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
      usedAt: null,
      revokedAt: null,
      revokeReason: null,
    });
    return { accessToken, refreshToken, expiresIn: accessTtlSeconds };
  }

  private async verify(
    token: string,
    ignoreExpiration = false,
  ): Promise<RefreshClaims> {
    let payload: Partial<RefreshClaims>;
    try {
      payload = await this.jwt.verifyAsync<Partial<RefreshClaims>>(token, {
        secret: this.config.refreshSecret,
        ignoreExpiration,
      });
    } catch {
      throw denied('INVALID_REFRESH_TOKEN');
    }
    if (
      payload.typ !== 'refresh' ||
      !payload.sub ||
      !payload.jti ||
      !payload.fam
    ) {
      throw denied('INVALID_REFRESH_TOKEN');
    }
    return payload as RefreshClaims;
  }

  private async spend(
    manager: EntityManager,
    claims: RefreshClaims,
  ): Promise<RotationOutcome> {
    const record = await manager.findOne(RefreshTokenRecord, {
      where: { id: claims.jti },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !record ||
      record.userId !== claims.sub ||
      record.familyId !== claims.fam
    ) {
      return { kind: 'denied', code: 'INVALID_REFRESH_TOKEN' };
    }
    if (record.revokedAt)
      return { kind: 'denied', code: 'REFRESH_TOKEN_REVOKED' };
    if (record.usedAt) return this.reused(manager, record);
    await manager.update(
      RefreshTokenRecord,
      { id: record.id },
      { usedAt: new Date() },
    );
    return { kind: 'rotate', userId: record.userId, familyId: record.familyId };
  }

  /** A spent token again: parallel tabs inside the grace window fork; anything later is theft. */
  private async reused(
    manager: EntityManager,
    record: RefreshTokenRecord,
  ): Promise<RotationOutcome> {
    const ageMs = Date.now() - (record.usedAt as Date).getTime();
    if (ageMs <= this.config.reuseGraceSeconds * 1000) {
      return {
        kind: 'rotate',
        userId: record.userId,
        familyId: record.familyId,
      };
    }
    await this.revokeFamily(manager, record.familyId, 'reuse');
    this.logger.warn(
      `Refresh token reuse detected; family ${record.familyId} revoked`,
    );
    return { kind: 'denied', code: 'REFRESH_TOKEN_REUSED' };
  }

  private async revokeFamily(
    manager: EntityManager,
    familyId: string,
    reason: string,
  ): Promise<number> {
    const result = await manager.update(
      RefreshTokenRecord,
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokeReason: reason },
    );
    return result.affected ?? 0;
  }
}

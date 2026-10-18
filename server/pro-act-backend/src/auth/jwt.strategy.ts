import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  bindRequestContext,
  TENANT_SELECTION_HEADER,
} from '../common/context/request-context';
import { RequestWithContext } from '../common/context/request-context.middleware';
import { RequestContextFactory } from './context/request-context.factory';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';
import { JWT_SECRET } from './jwt.constants';
import { isAccessToken } from './tokens/token-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly contextFactory: RequestContextFactory) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
      passReqToCallback: true,
    });
    if (JWT_SECRET === 'changeme' || JWT_SECRET.length < 32) {
      this.logger.warn(
        'JWT_SECRET is weak (default or shorter than 32 characters); set a strong secret in .env',
      );
    }
  }

  /**
   * Resolves the request identity (WF05): roles and scopes from `user_scopes`, the tenant from the
   * token or a validated `X-Tenant-Id`, bound to the ambient request context for services.
   */
  async validate(
    request: RequestWithContext,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    // a refresh token (or a token issued before plan 3.11) is never an access token
    if (!payload?.sub || !isAccessToken(payload)) {
      throw new UnauthorizedException('Invalid token payload');
    }
    const context = await this.contextFactory.build({
      payload,
      selectedTenant: request.headers[TENANT_SELECTION_HEADER],
      correlationId:
        request.requestContext?.correlationId ??
        String(request.headers['x-correlation-id'] ?? ''),
      method: request.method,
      path: request.path,
    });
    request.requestContext = context;
    bindRequestContext(context);
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: context.tenantId ?? undefined,
      organizationId: payload.organizationId,
    };
  }
}

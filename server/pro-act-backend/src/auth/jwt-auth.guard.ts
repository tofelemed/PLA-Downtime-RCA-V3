import {
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

interface PassportInfo {
  name?: string;
  message?: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  /** Any authentication failure is a 401; a plain Error here would surface as a 500. */
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false | null | undefined,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest<Request>();
    if (err) {
      this.logger.warn(
        `JWT authentication error for ${request.method} ${request.path}: ${describeFailure(err)}`,
      );
      throw err instanceof HttpException
        ? err
        : new UnauthorizedException('Unauthorized');
    }
    if (!user) {
      const reason = describeFailure(info) || 'Unauthorized';
      this.logger.warn(
        `JWT authentication failed for ${request.method} ${request.path}: ${reason}`,
      );
      throw new UnauthorizedException(reason);
    }
    return user;
  }
}

function describeFailure(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  const info = value as PassportInfo | undefined;
  return typeof info?.message === 'string' ? info.message : '';
}

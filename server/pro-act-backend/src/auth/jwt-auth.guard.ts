import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      this.logger.warn(`Missing Authorization header for ${request.method} ${request.path}`);
    } else {
      this.logger.debug(`Authorization header present: ${authHeader.substring(0, 20)}...`);
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    
    if (err) {
      this.logger.error(`JWT Auth Error for ${request.method} ${request.path}:`, err.message);
      throw err;
    }
    
    if (!user && info) {
      // Log the specific JWT verification error
      if (info.name === 'JsonWebTokenError') {
        this.logger.error(`JWT Verification Failed - Invalid Token: ${info.message}`);
        if (info.message.includes('invalid signature')) {
          this.logger.error('⚠️  Token signature mismatch - JWT_SECRET does not match the secret used to sign the token!');
          this.logger.error(`⚠️  Current JWT_SECRET length: ${process.env.JWT_SECRET?.length || 0}`);
          this.logger.error('⚠️  Solution: Clear localStorage, login again to get a fresh token signed with current JWT_SECRET');
        }
      } else if (info.name === 'TokenExpiredError') {
        this.logger.error(`JWT Verification Failed - Token Expired: ${info.message}`);
      } else {
        this.logger.error(`JWT Verification Failed: ${info.name} - ${info.message}`);
      }
      throw new Error(info.message || 'Unauthorized');
    }
    
    if (!user) {
      this.logger.error(`JWT Auth Failed - No user returned for ${request.method} ${request.path}`);
      throw new Error('Unauthorized');
    }
    
    return user;
  }
} 
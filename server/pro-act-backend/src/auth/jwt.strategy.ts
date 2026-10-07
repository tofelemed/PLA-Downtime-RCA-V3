import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_SECRET } from './jwt.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
      passReqToCallback: false,
    });
    
    // Log JWT_SECRET status (don't log the actual secret)
    const secretStatus = JWT_SECRET && JWT_SECRET !== 'changeme'
      ? `SET (length: ${JWT_SECRET.length})` 
      : 'USING DEFAULT (changeme)';
    this.logger.log(`JWT Strategy initialized with secret: ${secretStatus}`);
    this.logger.log(`JWT Strategy using JWT_SECRET length: ${JWT_SECRET.length}`);
    this.logger.log(`JWT Strategy using EXACT same secret constant as JwtModule`);
    
    // Add error handler to catch JWT verification errors
    this.logger.warn('⚠️  If you see "Unauthorized" errors, the token was signed with a different JWT_SECRET!');
    this.logger.warn('⚠️  Solution: Clear localStorage and login again to get a fresh token.');
  }

  async validate(payload: any) {
    this.logger.debug(`Validating JWT payload for user: ${payload?.email || payload?.sub || 'unknown'}`);
    
    if (!payload || !payload.sub) {
      this.logger.warn('Invalid JWT payload: missing sub (user ID)', payload);
      throw new UnauthorizedException('Invalid token payload');
    }
    
    const user = { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role,
      tenantId: payload.tenantId,
      organizationId: payload.organizationId
    };
    
    this.logger.debug(`JWT validation successful for user: ${user.email}`);
    return user;
  }
} 
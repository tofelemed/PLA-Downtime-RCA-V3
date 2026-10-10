import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { OrganizationModule } from '../organization/organization.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JWT_SECRET } from './jwt.constants';
import { AuthTokensModule } from './tokens/auth-tokens.module';
import { loadTokenConfig } from './tokens/token-config';

@Module({
  imports: [
    UsersModule,
    OrganizationModule,
    TenantModule,
    PassportModule,
    AuthTokensModule,
    // access tokens only; refresh tokens are signed by AuthTokenService with their own key (plan 3.11)
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: loadTokenConfig().accessTtlSeconds },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule, PassportModule, AuthService, AuthTokensModule],
})
export class AuthModule {} 
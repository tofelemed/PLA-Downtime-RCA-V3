import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../../common/common.module';
import { JWT_SECRET } from '../jwt.constants';
import { AuthTokenService } from './auth-token.service';
import { RefreshTokenCleanupJob } from './refresh-token-cleanup.job';
import { RefreshTokenRecord } from './refresh-token.entity';
import { loadTokenConfig } from './token-config';

/**
 * Token issuing, rotation and revocation (plan 3.11). Imported by AuthModule (API) and by the worker,
 * which runs the hourly purge; the cron only fires where the scheduler is registered.
 */
@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([RefreshTokenRecord]),
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: loadTokenConfig().accessTtlSeconds },
    }),
  ],
  providers: [AuthTokenService, RefreshTokenCleanupJob],
  exports: [AuthTokenService],
})
export class AuthTokensModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyCleanupJob } from './idempotency-cleanup.job';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyService } from './idempotency.service';

/**
 * Storage and retention of `@Idempotent()` outcomes. The API registers `IdempotencyInterceptor` as an
 * `APP_INTERCEPTOR`; the cleanup cron only fires where the scheduler runs (worker/all).
 */
@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey])],
  providers: [IdempotencyService, IdempotencyCleanupJob],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}

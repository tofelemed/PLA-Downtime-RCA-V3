import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LegacyWriteFreezeInterceptor } from './cutover/legacy-write-freeze.interceptor';

/**
 * Plan 3.10 runtime part: the MIG05 v1 write freeze. Remediation jobs, comparison and cutover
 * operations run from `scripts/cutover/*` (CLI, dry-run first) and need no HTTP surface.
 */
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LegacyWriteFreezeInterceptor },
  ],
})
export class MigrationCutoverModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeAuthenticator } from './realtime-authenticator';
import { RealtimeFeedService } from './realtime-feed.service';
import { ScopedRealtimeGateway } from './scoped-realtime.gateway';

/**
 * Scoped realtime channel of plan 3.1: `/realtime` Socket.IO namespace (JWT + RequestContext rooms) fed
 * from the outbox. Imported by AppModule only — the worker process serves no sockets.
 */
@Module({
  imports: [AuthModule],
  providers: [
    RealtimeAuthenticator,
    ScopedRealtimeGateway,
    RealtimeFeedService,
  ],
  exports: [ScopedRealtimeGateway, RealtimeFeedService],
})
export class ScopedRealtimeModule {}

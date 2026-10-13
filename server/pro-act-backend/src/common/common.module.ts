import { Global, Module } from '@nestjs/common';
import { Clock, SystemClock } from './clock/clock';
import { ShutdownCoordinator } from './scheduling/shutdown-coordinator.service';
import { CredentialEncryptionService } from './services/credential-encryption.service';

@Global()
@Module({
  providers: [
    CredentialEncryptionService,
    ShutdownCoordinator,
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [CredentialEncryptionService, ShutdownCoordinator, Clock],
})
export class CommonModule {}

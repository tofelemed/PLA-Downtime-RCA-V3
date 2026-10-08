import { Global, Module } from '@nestjs/common';
import { ShutdownCoordinator } from './scheduling/shutdown-coordinator.service';
import { CredentialEncryptionService } from './services/credential-encryption.service';

@Global()
@Module({
  providers: [CredentialEncryptionService, ShutdownCoordinator],
  exports: [CredentialEncryptionService, ShutdownCoordinator],
})
export class CommonModule {}

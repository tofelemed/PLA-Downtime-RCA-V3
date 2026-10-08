import { Injectable, Logger } from '@nestjs/common';
import { envInt } from '../../common/helpers/time-bounds';
import { IntegrationConnectionService } from '../../intake/connections/integration-connection.service';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { connectionBaseUrl } from '../../pi-proxy/pi-proxy-policy';
import { PiHttpClient, PiRequestError } from './pi-http-client';

/**
 * Builds the PI Web API client of an `integration_connections` row: base URL and user from
 * `endpoint_config`, password from the connection secret (never from the browser, PI02), TLS
 * verification on unless `endpoint_config.allowInsecureTls === true` (an audited connection setting,
 * logged on every client build). Timeouts, attempts and the response bound come from the environment.
 */
@Injectable()
export class PiClientFactory {
  private readonly logger = new Logger(PiClientFactory.name);

  constructor(private readonly connections: IntegrationConnectionService) {}

  async forConnection(
    connection: IntegrationConnection,
  ): Promise<PiHttpClient> {
    const config = connection.endpointConfig;
    const base =
      typeof config.piWebApiUrl === 'string'
        ? connectionBaseUrl(config.piWebApiUrl)
        : null;
    if (!base) {
      throw new PiRequestError(
        `Connection ${connection.id} has no valid piWebApiUrl`,
        'rejected',
      );
    }
    const insecure = config.allowInsecureTls === true;
    if (insecure && base.protocol === 'https:') {
      this.logger.warn(
        `PI connection ${connection.id} runs with TLS verification disabled (allowInsecureTls)`,
      );
    }
    return new PiHttpClient({
      apiBase: `${base.origin}${base.pathname}`,
      username: typeof config.username === 'string' ? config.username : null,
      password: await this.connections.revealSecret(connection),
      verifyTls: !insecure,
      timeoutMs: envInt('PI_HTTP_TIMEOUT_MS', 30_000),
      maxAttempts: envInt('PI_HTTP_MAX_ATTEMPTS', 3),
      retryBaseMs: envInt('PI_HTTP_RETRY_BASE_MS', 500),
      maxResponseBytes: envInt('PI_HTTP_MAX_RESPONSE_BYTES', 64 * 1024 * 1024),
    });
  }
}

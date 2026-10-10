import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosBasicCredentials, AxiosRequestConfig } from 'axios';
import { isEgressAllowed } from '../common/security/egress-allowlist';
import * as https from 'https';
import { Repository } from 'typeorm';
import { CredentialEncryptionService } from '../common/services/credential-encryption.service';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIProxyRequestDto } from './dto/pi-proxy-request.dto';
import { PIProxyTargetDto } from './dto/pi-proxy-target.dto';
import {
  PI_PROXY_ALLOWED_PREFIXES,
  PI_PROXY_MAX_REQUEST_BYTES,
  PI_PROXY_MAX_RESPONSE_BYTES,
  PI_PROXY_TIMEOUT_MS,
  isTlsVerificationDisabled,
  resolveProxyUrl,
  sameOrigin,
  ResolvedProxyUrl,
} from './pi-proxy-policy';

export interface PIProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
];

/**
 * Forwards browser requests to PI Web API, but only to hosts configured as PI connections of the caller's
 * tenant, under allowlisted paths, with GET/POST, bounded response size and TLS verification on by default.
 */
@Injectable()
export class PIProxyService {
  private readonly logger = new Logger(PIProxyService.name);

  constructor(
    @InjectRepository(PIConnection)
    private readonly connections: Repository<PIConnection>,
    private readonly credentials: CredentialEncryptionService,
  ) {}

  async forward(
    tenantId: string,
    request: PIProxyRequestDto,
  ): Promise<PIProxyResponse> {
    const connection = await this.selectConnection(tenantId, request);
    const resolved = resolveProxyUrl(connection.piWebApiUrl, request.path);
    if (!resolved) {
      throw new ForbiddenException({
        code: 'PI_PROXY_PATH_NOT_ALLOWED',
        message: `Only ${PI_PROXY_ALLOWED_PREFIXES.join(', ')} under the connection PI Web API root can be proxied`,
      });
    }

    if (!isEgressAllowed(resolved.url)) {
      throw new ForbiddenException({
        code: 'PI_EGRESS_DENIED',
        message: 'The connection host is not in the connector egress allowlist',
      });
    }
    const method = request.method ?? 'GET';
    const config: AxiosRequestConfig = {
      method,
      url: resolved.url,
      params: request.params,
      data: method === 'POST' ? request.data : undefined,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      auth: this.basicAuth(connection, request),
      httpsAgent: new https.Agent({
        rejectUnauthorized: !isTlsVerificationDisabled(
          connection.connectionConfig,
        ),
      }),
      timeout: PI_PROXY_TIMEOUT_MS,
      maxContentLength: PI_PROXY_MAX_RESPONSE_BYTES,
      maxBodyLength: PI_PROXY_MAX_REQUEST_BYTES,
      maxRedirects: 0,
      validateStatus: () => true,
    };

    try {
      const response = await axios.request(config);
      return {
        status: response.status,
        statusText: response.statusText,
        headers: pickHeaders(response.headers as Record<string, unknown>),
        data: response.data as unknown,
      };
    } catch (error) {
      throw this.mapUpstreamError(error, resolved);
    }
  }

  async testConnection(tenantId: string, target: PIProxyTargetDto) {
    const result = await this.forward(tenantId, {
      ...target,
      path: '/assetservers',
      method: 'GET',
    });
    return {
      connected: result.status === 200,
      status: result.status,
      message:
        result.status === 200 ? 'Connection successful' : 'Connection failed',
    };
  }

  private async selectConnection(
    tenantId: string,
    request: PIProxyTargetDto,
  ): Promise<PIConnection> {
    const candidates = await this.connections.find({
      where: { tenantId, isActive: true },
    });
    if (request.connectionId) {
      const match = candidates.find(
        (candidate) => candidate.id === request.connectionId,
      );
      if (!match) {
        throw new ForbiddenException({
          code: 'PI_PROXY_CONNECTION_NOT_ALLOWED',
          message: 'The PI connection does not belong to your tenant',
        });
      }
      return match;
    }
    if (request.target) {
      const target = request.target;
      const match = candidates.find((candidate) =>
        sameOrigin(target, candidate.piWebApiUrl),
      );
      if (!match) {
        throw new ForbiddenException({
          code: 'PI_PROXY_HOST_NOT_ALLOWED',
          message:
            'Requests may only target the PI Web API hosts configured for your tenant',
        });
      }
      return match;
    }
    if (candidates.length === 1) {
      return candidates[0];
    }
    if (candidates.length === 0) {
      throw new ForbiddenException({
        code: 'PI_PROXY_NO_CONNECTION',
        message: 'No active PI connection is configured for your tenant',
      });
    }
    throw new BadRequestException({
      code: 'PI_PROXY_AMBIGUOUS_TARGET',
      message:
        'Several PI connections exist for this tenant; pass connectionId or target',
    });
  }

  private basicAuth(
    connection: PIConnection,
    request: PIProxyRequestDto,
  ): AxiosBasicCredentials | undefined {
    if (request.username && request.password) {
      return { username: request.username, password: request.password };
    }
    if (connection.username && connection.passwordEncrypted) {
      return {
        username: connection.username,
        password: this.credentials.decrypt(connection.passwordEncrypted),
      };
    }
    return undefined;
  }

  private mapUpstreamError(
    error: unknown,
    resolved: ResolvedProxyUrl,
  ): HttpException {
    const axiosError = axios.isAxiosError(error) ? error : undefined;
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `PI proxy call to ${resolved.origin}${resolved.pathname} failed (${axiosError?.code ?? 'n/a'}): ${reason}`,
    );

    if (
      axiosError?.code === 'ECONNABORTED' ||
      axiosError?.code === 'ETIMEDOUT'
    ) {
      return new GatewayTimeoutException({
        code: 'UPSTREAM_TIMEOUT',
        message: 'PI Web API did not respond in time',
      });
    }
    if (reason.includes('maxContentLength')) {
      return new BadGatewayException({
        code: 'UPSTREAM_RESPONSE_TOO_LARGE',
        message: `PI Web API response exceeded ${PI_PROXY_MAX_RESPONSE_BYTES} bytes`,
      });
    }
    return new BadGatewayException({
      code: 'UPSTREAM_ERROR',
      message: 'PI Web API request failed',
    });
  }
}

function pickHeaders(headers: Record<string, unknown>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = headers[name];
    if (typeof value === 'string') {
      picked[name] = value;
    }
  }
  return picked;
}

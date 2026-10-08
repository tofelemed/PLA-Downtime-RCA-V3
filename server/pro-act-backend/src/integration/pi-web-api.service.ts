import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { CredentialEncryptionService } from '../common/services/credential-encryption.service';
import {
  isTlsVerificationDisabled,
  PI_PROXY_ALLOWED_PREFIXES,
  PI_PROXY_MAX_RESPONSE_BYTES,
  resolveProxyUrl,
} from '../pi-proxy/pi-proxy-policy';
import { PIBrowserRequestDto } from './dto/pi-browser-request.dto';

@Injectable()
export class PIWebApiService {
  private readonly logger = new Logger(PIWebApiService.name);

  constructor(
    @InjectRepository(PIConnection)
    private readonly piConnectionRepository: Repository<PIConnection>,
    private readonly credentialEncryption: CredentialEncryptionService,
  ) {}

  async getActiveConnection(tenantId: string): Promise<PIConnection> {
    const connection = await this.piConnectionRepository.findOne({
      where: { tenantId, isActive: true },
    });
    if (!connection) {
      throw new NotFoundException(`No active PI connection found for tenant ${tenantId}`);
    }
    if (!connection.username || !connection.passwordEncrypted) {
      throw new BadRequestException('PI connection missing credentials');
    }
    return connection;
  }

  getApiBase(connection: PIConnection): string {
    const baseUrl = connection.piWebApiUrl.endsWith('/')
      ? connection.piWebApiUrl.slice(0, -1)
      : connection.piWebApiUrl;
    return baseUrl.endsWith('/piwebapi') ? baseUrl : `${baseUrl}/piwebapi`;
  }

  getDecryptedPassword(connection: PIConnection): string {
    return this.credentialEncryption.decrypt(connection.passwordEncrypted || '');
  }

  resolveScope(connection: PIConnection, scopeType?: 'database' | 'element', scopeId?: string) {
    const config = connection.connectionConfig ? JSON.parse(connection.connectionConfig) : {};
    const resolvedScopeType = scopeType || (config.databaseWebId ? 'database' : 'element');
    const resolvedScopeId = scopeId || config.databaseWebId || config.elementWebId || config.afDatabase?.webId || config.afRootElement?.webId;

    if (!resolvedScopeId) {
      throw new BadRequestException('No scope (database or element) specified for PI request');
    }

    return { scopeType: resolvedScopeType as 'database' | 'element', scopeId: resolvedScopeId };
  }

  async request<T = any>(
    tenantId: string,
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      params?: Record<string, string | number | boolean | undefined>;
      data?: any;
      connection?: PIConnection;
      /** an already resolved absolute URL (allowlisted browser requests) */
      url?: string;
      maxResponseBytes?: number;
    },
  ): Promise<T> {
    const connection = options?.connection || (await this.getActiveConnection(tenantId));
    const password = this.getDecryptedPassword(connection);
    const apiBase = this.getApiBase(connection);

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = options?.url ?? `${apiBase}${normalizedPath}`;

    const axiosConfig: AxiosRequestConfig = {
      method: options?.method || 'GET',
      url,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      params: options?.params,
      data: options?.data,
      auth: {
        username: connection.username!,
        password,
      },
      // TLS verified unless the connection opts out explicitly (plan 1.6, §4.2)
      httpsAgent: new https.Agent({
        rejectUnauthorized: !isTlsVerificationDisabled(connection.connectionConfig),
      }),
      validateStatus: () => true,
      timeout: 30000,
      maxRedirects: 0,
      ...(options?.maxResponseBytes
        ? { maxContentLength: options.maxResponseBytes }
        : {}),
    };

    const response = await axios(axiosConfig);
    if (response.status < 200 || response.status >= 300) {
      throw new BadRequestException(
        `PI Web API request failed (${response.status}): ${response.statusText}`,
      );
    }

    return response.data as T;
  }

  /**
   * A browser request with the tenant's stored credentials (§4.2, I12): only allowlisted controllers
   * on the connection's own host, GET or POST to `/batch`, responses up to 5 MiB, no redirects.
   */
  async browserRequest(tenantId: string, body: PIBrowserRequestDto): Promise<unknown> {
    const connection = await this.getActiveConnection(tenantId);
    const resolved = resolveProxyUrl(connection.piWebApiUrl, body.path);
    const method = body.method ?? 'GET';
    const batch = /\/batch\/?$/i.test(resolved?.pathname ?? '');
    if (!resolved || (method === 'POST' && !batch)) {
      throw new ForbiddenException({
        code: 'PI_PROXY_PATH_NOT_ALLOWED',
        message: `Only GET under ${PI_PROXY_ALLOWED_PREFIXES.join(', ')} (and POST /batch) can be requested`,
      });
    }
    try {
      return await this.request(tenantId, body.path, {
        method,
        params: body.params,
        data: method === 'POST' ? body.data : undefined,
        connection,
        url: resolved.url,
        maxResponseBytes: PI_PROXY_MAX_RESPONSE_BYTES,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/maxContentLength/i.test(message)) {
        throw new BadGatewayException({
          code: 'PI_RESPONSE_TOO_LARGE',
          message: 'The PI Web API response exceeds 5 MiB',
        });
      }
      throw error;
    }
  }

  async testConnection(tenantId: string): Promise<{ connected: boolean; message: string }> {
    try {
      await this.request(tenantId, '/assetservers');
      return { connected: true, message: 'Connection successful' };
    } catch (error: any) {
      this.logger.error(`PI connection test failed for tenant ${tenantId}: ${error.message}`);
      return { connected: false, message: error.message || 'Connection test failed' };
    }
  }

  async getEventFrames(
    tenantId: string,
    params: {
      scopeType?: 'database' | 'element';
      scopeId?: string;
      startTimeUtc: string;
      endTimeUtc: string;
      templateName?: string;
      maxCount?: number;
      startIndex?: number;
    },
  ) {
    const connection = await this.getActiveConnection(tenantId);
    const { scopeType, scopeId } = this.resolveScope(connection, params.scopeType, params.scopeId);

    const queryParams: Record<string, string> = {
      startTime: params.startTimeUtc,
      endTime: params.endTimeUtc,
      sortField: 'StartTime',
      sortOrder: 'Ascending',
      maxCount: String(params.maxCount || 200),
    };

    if (params.templateName) queryParams.templateName = params.templateName;
    if (typeof params.startIndex === 'number') queryParams.startIndex = String(params.startIndex);

    const path =
      scopeType === 'database'
        ? `/assetdatabases/${encodeURIComponent(scopeId)}/eventframes`
        : `/elements/${encodeURIComponent(scopeId)}/eventframes`;

    return this.request(tenantId, path, { params: queryParams, connection });
  }
}

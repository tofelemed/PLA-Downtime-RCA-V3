import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { CredentialEncryptionService } from '../common/services/credential-encryption.service';

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
    },
  ): Promise<T> {
    const connection = options?.connection || (await this.getActiveConnection(tenantId));
    const password = this.getDecryptedPassword(connection);
    const apiBase = this.getApiBase(connection);

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${apiBase}${normalizedPath}`;

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
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      validateStatus: () => true,
      timeout: 30000,
    };

    const response = await axios(axiosConfig);
    if (response.status !== 200) {
      throw new BadRequestException(
        `PI Web API request failed (${response.status}): ${response.statusText}`,
      );
    }

    return response.data as T;
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

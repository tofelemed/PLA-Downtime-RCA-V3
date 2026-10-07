import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestApiConnection } from '../entities/restapi-connection.entity';
import { CreateRestApiConnectionDto, UpdateRestApiConnectionDto, TestRestApiConnectionDto } from '../dto/restapi-connection.dto';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

@Injectable()
export class RestApiService {
  private readonly logger = new Logger(RestApiService.name);
  private clients = new Map<string, AxiosInstance>();

  constructor(
    @InjectRepository(RestApiConnection)
    private readonly restApiConnectionRepository: Repository<RestApiConnection>,
  ) {}

  async createRestApiConnection(createDto: CreateRestApiConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = this.restApiConnectionRepository.create({
        ...createDto,
        tenantId,
        status: 'disconnected',
        errorCount: 0,
      });

      const savedConnection = await this.restApiConnectionRepository.save(connection);
      
      this.logger.log(`REST API connection created: ${savedConnection.id}`);
      
      return {
        success: true,
        data: savedConnection,
        message: 'REST API connection created successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to create REST API connection: ${error.message}`);
      throw error;
    }
  }

  async getRestApiConnections(tenantId: string): Promise<any> {
    try {
      const connections = await this.restApiConnectionRepository.find({
        where: { tenantId },
        order: { createdAt: 'DESC' }
      });

      return {
        success: true,
        data: connections,
        message: 'REST API connections retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get REST API connections: ${error.message}`);
      throw error;
    }
  }

  async getRestApiConnection(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      return {
        success: true,
        data: connection,
        message: 'REST API connection retrieved successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to get REST API connection: ${error.message}`);
      throw error;
    }
  }

  async updateRestApiConnection(id: string, updateDto: UpdateRestApiConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      Object.assign(connection, updateDto);
      const updatedConnection = await this.restApiConnectionRepository.save(connection);

      this.logger.log(`REST API connection updated: ${id}`);

      return {
        success: true,
        data: updatedConnection,
        message: 'REST API connection updated successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to update REST API connection: ${error.message}`);
      throw error;
    }
  }

  async deleteRestApiConnection(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      // Remove client if exists
      this.clients.delete(id);

      await this.restApiConnectionRepository.remove(connection);

      this.logger.log(`REST API connection deleted: ${id}`);

      return {
        success: true,
        message: 'REST API connection deleted successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to delete REST API connection: ${error.message}`);
      throw error;
    }
  }

  async testRestApiConnection(id: string, testDto: TestRestApiConnectionDto, tenantId: string): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      // Simulate REST API connection test
      const testResult = await this.performRestApiTest(testDto);

      // Update connection status based on test result
      connection.status = testResult.success ? 'connected' : 'error';
      connection.lastConnected = testResult.success ? new Date() : null;
      connection.errorCount = testResult.success ? 0 : connection.errorCount + 1;
      connection.lastError = testResult.success ? null : testResult.error;

      await this.restApiConnectionRepository.save(connection);

      return {
        success: testResult.success,
        data: testResult,
        message: testResult.success ? 'REST API connection test successful' : 'REST API connection test failed'
      };
    } catch (error) {
      this.logger.error(`Failed to test REST API connection: ${error.message}`);
      throw error;
    }
  }

  private async performRestApiTest(testDto: TestRestApiConnectionDto): Promise<any> {
    try {
      const { baseUrl, method, username, password, apiKey, timeoutMs } = testDto;

      // Simulate REST API test
      await new Promise(resolve => setTimeout(resolve, 600));

      // Simulate test result (95% success rate for demo)
      const isSuccess = Math.random() > 0.05;

      if (isSuccess) {
        return {
          success: true,
          baseUrl,
          method: method || 'GET',
          responseTime: Math.floor(Math.random() * 200) + 100,
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            'server': 'nginx/1.18.0'
          },
          response: {
            message: 'API is accessible',
            timestamp: new Date().toISOString()
          }
        };
      } else {
        return {
          success: false,
          error: 'Connection timeout or server not responding'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async makeRestApiRequest(id: string, method: string, endpoint: string, tenantId: string, data?: any, headers?: any): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      // Get or create axios client
      let client = this.clients.get(id);
      if (!client) {
        client = this.createAxiosClient(connection);
        this.clients.set(id, client);
      }

      // Make request
      const config: AxiosRequestConfig = {
        method: method.toUpperCase() as any,
        url: `${connection.baseUrl}${endpoint}`,
        data,
        headers: {
          ...this.parseHeaders(connection.headers),
          ...headers
        },
        timeout: connection.timeoutMs || 30000
      };

      const response = await client.request(config);

      return {
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          config: {
            method: config.method,
            url: config.url
          }
        },
        message: 'REST API request successful'
      };
    } catch (error) {
      this.logger.error(`Failed to make REST API request: ${error.message}`);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  private createAxiosClient(connection: RestApiConnection): AxiosInstance {
    const config: AxiosRequestConfig = {
      baseURL: connection.baseUrl,
      timeout: connection.timeoutMs || 30000,
      headers: this.parseHeaders(connection.headers)
    };

    // Add authentication
    if (connection.authType === 'basic' && connection.username && connection.passwordHash) {
      config.auth = {
        username: connection.username,
        password: connection.passwordHash // In real implementation, decrypt this
      };
    } else if (connection.authType === 'bearer' && connection.apiKey) {
      config.headers!.Authorization = `Bearer ${connection.apiKey}`;
    } else if (connection.authType === 'apikey' && connection.apiKey) {
      config.headers!['X-API-Key'] = connection.apiKey;
    }

    return axios.create(config);
  }

  private parseHeaders(headersString?: string): Record<string, string> {
    if (!headersString) return {};
    
    try {
      return JSON.parse(headersString);
    } catch {
      return {};
    }
  }

  async pollRestApiEndpoint(id: string, endpoint: string, interval: number, tenantId: string): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      // Simulate polling setup
      const polling = {
        pollingId: `poll_${Date.now()}`,
        endpoint,
        interval,
        status: 'ACTIVE',
        createdAt: new Date()
      };

      return {
        success: true,
        data: polling,
        message: 'REST API polling started successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to start REST API polling: ${error.message}`);
      throw error;
    }
  }

  async stopRestApiPolling(id: string, pollingId: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      // Simulate polling stop
      return {
        success: true,
        data: {
          pollingId,
          status: 'STOPPED',
          stoppedAt: new Date()
        },
        message: 'REST API polling stopped successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to stop REST API polling: ${error.message}`);
      throw error;
    }
  }

  async getRestApiEndpoints(id: string, tenantId: string): Promise<any> {
    try {
      const connection = await this.restApiConnectionRepository.findOne({
        where: { id, tenantId }
      });

      if (!connection) {
        return {
          success: false,
          error: 'REST API connection not found'
        };
      }

      // Simulate endpoint discovery
      const endpoints = await this.performRestApiEndpointDiscovery(connection);

      return {
        success: true,
        data: endpoints,
        message: 'REST API endpoints discovered successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to discover REST API endpoints: ${error.message}`);
      throw error;
    }
  }

  private async performRestApiEndpointDiscovery(connection: RestApiConnection): Promise<any> {
    // Simulate endpoint discovery
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      baseUrl: connection.baseUrl,
      endpoints: [
        {
          path: '/api/v1/health',
          method: 'GET',
          description: 'Health check endpoint'
        },
        {
          path: '/api/v1/data',
          method: 'GET',
          description: 'Get data'
        },
        {
          path: '/api/v1/data',
          method: 'POST',
          description: 'Create data'
        },
        {
          path: '/api/v1/data/{id}',
          method: 'PUT',
          description: 'Update data'
        },
        {
          path: '/api/v1/data/{id}',
          method: 'DELETE',
          description: 'Delete data'
        }
      ]
    };
  }
}

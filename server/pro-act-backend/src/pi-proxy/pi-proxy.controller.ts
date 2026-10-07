import { Controller, Post, Body, Headers, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import axios, { AxiosRequestConfig } from 'axios';

interface PIProxyRequest {
  target: string; // PI Web API base URL (e.g., https://87.107.103.198:7443/piwebapi)
  path: string;   // API path (e.g., /assetservers)
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  username?: string;
  password?: string;
  data?: any;
  params?: Record<string, any>;
}

@ApiTags('PI Proxy')
@Controller('pi-proxy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PIProxyController {
  
  @Post('request')
  @ApiOperation({ summary: 'Proxy requests to PI Web API' })
  async proxyRequest(
    @Body() request: PIProxyRequest,
    @Headers() headers: any
  ): Promise<{ status: number; statusText: string; headers: Record<string, any>; data: any }> {
    try {
      // Validate request
      if (!request.target || !request.path) {
        throw new HttpException(
          'Missing required fields: target and path',
          HttpStatus.BAD_REQUEST
        );
      }

      // Build full URL
      const targetUrl = request.target.endsWith('/')
        ? request.target.slice(0, -1)
        : request.target;
      const path = request.path.startsWith('/')
        ? request.path
        : `/${request.path}`;
      const fullUrl = `${targetUrl}${path}`;

      // Build axios config
      const config: AxiosRequestConfig = {
        method: request.method || 'GET',
        url: fullUrl,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        // Disable SSL verification for self-signed certificates (development only)
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        }),
        validateStatus: () => true, // Don't throw on any status code
      };

      // Add authentication if provided
      if (request.username && request.password) {
        config.auth = {
          username: request.username,
          password: request.password,
        };
      }

      // Add request body for POST/PUT/PATCH
      if (request.data && ['POST', 'PUT', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
        config.data = request.data;
      }

      // Add query parameters
      if (request.params) {
        config.params = request.params;
      }

      // Make the request
      const response = await axios(config);

      // Return the response
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      };
    } catch (error: any) {
      console.error('PI Proxy Error:', error.message);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        throw new HttpException(
          {
            message: 'PI Web API request failed',
            status: error.response.status,
            data: error.response.data,
          },
          error.response.status
        );
      } else if (error.request) {
        // The request was made but no response was received
        throw new HttpException(
          {
            message: 'No response from PI Web API',
            error: 'Network error or timeout',
          },
          HttpStatus.GATEWAY_TIMEOUT
        );
      } else {
        // Something happened in setting up the request
        throw new HttpException(
          {
            message: 'Failed to create PI Web API request',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }

  @Post('test-connection')
  @ApiOperation({ summary: 'Test PI Web API connection' })
  async testConnection(@Body() request: { target: string; username?: string; password?: string }) {
    try {
      const result = await this.proxyRequest(
        {
          target: request.target,
          path: '/assetservers',
          method: 'GET',
          username: request.username,
          password: request.password,
        },
        {}
      );

      return {
        connected: result.status === 200,
        status: result.status,
        message: result.status === 200 ? 'Connection successful' : 'Connection failed',
      };
    } catch (error: any) {
      return {
        connected: false,
        status: error.status || 500,
        message: error.message || 'Connection failed',
        error: error.response?.data || error.message,
      };
    }
  }
}


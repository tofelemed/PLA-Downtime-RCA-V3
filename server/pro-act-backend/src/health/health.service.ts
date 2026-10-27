import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { buildInfo } from './build-info';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async check() {
    const dbStatus = await this.checkDatabase();

    return {
      status: dbStatus ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbStatus ? 'connected' : 'disconnected',
      ...buildInfo(),
    };
  }

  /** Readiness probe: `SELECT 1` only, no host or runtime details (the route is public). */
  async ready() {
    const dbStatus = await this.checkDatabase();
    return {
      status: dbStatus ? 'ready' : 'unavailable',
      database: dbStatus ? 'connected' : 'disconnected',
    };
  }

  async detailedCheck() {
    const dbStatus = await this.checkDatabase();
    const memoryUsage = process.memoryUsage();

    return {
      status: dbStatus ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus ? 'connected' : 'disconnected',
        type: this.dataSource.options.type,
        host: (this.dataSource.options as PostgresConnectionOptions).host,
        database: (this.dataSource.options as PostgresConnectionOptions)
          .database,
      },
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB',
      },
      version: process.version,
      platform: process.platform,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

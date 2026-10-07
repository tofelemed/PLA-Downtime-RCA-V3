import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TableInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TableInitService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    // T-SQL bootstrap only; on Postgres these tables come from the entities via schema sync
    if (this.dataSource.options.type !== 'mssql') {
      return;
    }
    await this.ensureRolesTable();
    await this.ensureTasksTable();
  }

  private async ensureRolesTable(): Promise<void> {
    const query = `
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[roles]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[roles] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [name] NVARCHAR(100) NOT NULL UNIQUE,
        [description] NVARCHAR(MAX) NULL,
        [permissions] NVARCHAR(MAX) NULL
    );
    CREATE INDEX idx_roles_created_at ON [dbo].[roles]([created_at]);
END`;
    await this.executeQuery(query, 'roles');
  }

  private async ensureTasksTable(): Promise<void> {
    const query = `
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tasks]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[tasks] (
        [id] VARCHAR(36) PRIMARY KEY,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [title] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [assigned_to] VARCHAR(36) NOT NULL,
        [assigned_by] VARCHAR(36) NOT NULL,
        [priority] VARCHAR(50) NOT NULL,
        [status] VARCHAR(50) NOT NULL,
        [due_date] DATETIME NULL,
        [completed_date] DATETIME NULL,
        [entity_type] VARCHAR(100) NULL,
        [entity_id] VARCHAR(36) NULL,
        [organization_id] VARCHAR(36) NOT NULL,
        [tenant_id] VARCHAR(36) NOT NULL
    );
    CREATE INDEX idx_tasks_tenant_id ON [dbo].[tasks]([tenant_id]);
    CREATE INDEX idx_tasks_assigned_to ON [dbo].[tasks]([assigned_to]);
    CREATE INDEX idx_tasks_status ON [dbo].[tasks]([status]);
END`;
    await this.executeQuery(query, 'tasks');
  }

  private async executeQuery(query: string, tableName: string): Promise<void> {
    try {
      await this.dataSource.query(query);
      this.logger.log(`Ensured ${tableName} table exists`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed ensuring ${tableName} table`, err.stack);
    }
  }
}


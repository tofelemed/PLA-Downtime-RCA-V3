import 'reflect-metadata';
import { config } from 'dotenv';
import { join } from 'path';
import * as sql from 'mssql';

config({ path: join(__dirname, '..', '.env') });

async function ensureTables(): Promise<void> {
  const pool = await sql.connect({
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 1433),
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  });

  const rolesSql = `
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

  const tasksSql = `
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

  await pool.request().query(rolesSql);
  await pool.request().query(tasksSql);
  await pool.close();
  console.log('Ensured roles and tasks tables exist');
}

ensureTables().catch((error) => {
  console.error('Failed to ensure tables', error);
  process.exit(1);
});


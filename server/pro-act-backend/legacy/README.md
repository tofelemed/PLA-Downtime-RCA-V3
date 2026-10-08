# Legacy SQL Server scripts (not used)

These folders hold the SQL Server (`.sql` / PowerShell) scripts from before the move to PostgreSQL.
Nothing in the application, Docker image or CI reads them, and they do not describe the current schema.

- `mssql-migrations/`: was `migrations/`
- `mssql-database-setup/`: was `database-setup/`

The schema now comes from TypeORM migrations in `src/database/migrations` (conventions:
`src/database/MIGRATIONS.md`). Kept for reference only; delete once nobody needs the history
(plan 0.3 step 8).

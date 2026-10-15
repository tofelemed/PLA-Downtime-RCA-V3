param([switch]$RefreshFrontend)
$ErrorActionPreference = 'Stop'
$database = 'proact_ui_followup_test'
$network = 'proact_default'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$evidence = Join-Path $root 'test-results/hdpe-followup'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

function Invoke-Docker([string[]]$Arguments) {
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker operation failed: $($Arguments[0])" }
}

if (-not $RefreshFrontend) {
    # This database is a disposable restore of the final HDPE snapshot. Never change the live DB.
    $found = & docker exec proact-postgres psql -U postgres -d $database -X -At -c 'SELECT current_database()'
    if ($LASTEXITCODE -ne 0 -or $found -ne $database) { throw 'Isolated database identity did not match.' }
    $sql = @'
BEGIN;
UPDATE integration_connections SET is_active = false;
UPDATE pi_connections SET is_active = false;
UPDATE pi_sync_jobs SET is_active = false;
UPDATE stream_connection_configs SET enabled = false;
COMMIT;
SELECT current_database(), count(*) FILTER (WHERE is_active) AS active_connections FROM integration_connections;
'@
    $sql | & docker exec -i proact-postgres psql -U postgres -d $database -X -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Could not disable cloned external connectors.' }

    # Pass secret values through inherited environment only; never echo them or write another env file.
    $live = (& docker inspect proact-backend-1 | ConvertFrom-Json)[0]
    $secretKeys = @('DB_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'CREDENTIAL_ENCRYPTION_KEY', 'CREDENTIAL_ENCRYPTION_KEYS', 'CREDENTIAL_ENCRYPTION_KEY_ID')
    foreach ($entry in $live.Config.Env) {
        $parts = $entry.Split('=', 2)
        if ($parts[0] -in $secretKeys) { [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process') }
    }
    $shared = @('--network', $network, '--init', '--mount', 'type=volume,source=proact-ui-followup-exports,target=/app/storage/exports',
        '-e', 'EXPORT_STORAGE_DIR=/app/storage/exports', '-e', 'NODE_ENV=production', '-e', "DB_NAME=$database",
        '-e', 'DB_HOST=proact-postgres', '-e', 'DB_PORT=5432', '-e', 'DB_USERNAME=postgres',
        '-e', 'DB_MIGRATIONS_RUN=false', '-e', 'DB_RLS_TENANT_BINDING=true',
        '-e', 'KAFKA_BROKERS=127.0.0.1:9092', '-e', 'MQTT_URL=mqtt://127.0.0.1:1883')
    foreach ($key in $secretKeys) { $shared += @('-e', $key) }
    Invoke-Docker (@('run', '-d', '--name', 'proact-ui-followup-api', '-p', '127.0.0.1:4006:4004') + $shared +
        @('-e', 'PROCESS_ROLE=api', '-e', 'PORT=4004', '-e', 'CORS_ORIGIN=http://localhost:8071', 'proact-backend'))
    Invoke-Docker (@('run', '-d', '--name', 'proact-ui-followup-worker') + $shared +
        @('-e', 'PROCESS_ROLE=worker', '-e', 'WORKER_PORT=4005', 'proact-backend'))
    foreach ($key in $secretKeys) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
} else {
    # Only the explicitly task-owned UI container is replaced; DB/API/worker stay intact.
    Invoke-Docker @('rm', '-f', 'proact-ui-followup-frontend')
}
Invoke-Docker @('run', '-d', '--name', 'proact-ui-followup-frontend', '--network', $network,
    '-p', '127.0.0.1:8071:80', '-e', 'BACKEND_URL=http://proact-ui-followup-api:4004',
    '-e', 'PI_SERVER=http://127.0.0.1:1', 'proact-frontend')
Write-Output 'Isolated UI stack: frontend http://localhost:8071; API http://localhost:4006/api.'

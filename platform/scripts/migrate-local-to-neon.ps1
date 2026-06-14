# Copy local Docker PostgreSQL -> Neon (schema + data).
# Usage:
#   $env:NEON_DATABASE_URL = "postgresql://USER:PASS@ep-....neon.tech/neondb?sslmode=require"
#   .\scripts\migrate-local-to-neon.ps1
#
# Prerequisite: Docker container sparc-assessment-db running locally.
# Prerequisite: psql on PATH (PostgreSQL client tools) OR set $PsqlPath.

param(
    [string]$NeonDatabaseUrl = $env:NEON_DATABASE_URL,
    [string]$LocalContainer = "sparc-assessment-db",
    [switch]$SchemaOnly
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($NeonDatabaseUrl)) {
    Write-Error "Set NEON_DATABASE_URL to your Neon connection string (use the pooled URL for apps; direct URL is OK for this one-time import)."
}

$platformRoot = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $platformRoot "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpFile = Join-Path $backupDir "sparc-to-neon-$stamp.sql"

Write-Host "Creating local dump from Docker container $LocalContainer ..."
$dumpArgs = @("-U", "sparc", "-d", "sparc_assessment", "--no-owner", "--no-acl")
if ($SchemaOnly) { $dumpArgs += "--schema-only" }

docker exec -t $LocalContainer pg_dump @dumpArgs | Set-Content -Encoding utf8 $dumpFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed. Start local DB: cd platform; docker compose up -d"
}

Write-Host "Saved: $dumpFile"

$psql = $env:PSQL_PATH
if ([string]::IsNullOrWhiteSpace($psql)) { $psql = "psql" }

Write-Host "Restoring into Neon (this may take a few minutes) ..."
Write-Host "Target host is hidden; using NEON_DATABASE_URL from environment."

& $psql $NeonDatabaseUrl -v ON_ERROR_STOP=1 -f $dumpFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "Restore failed. Check Neon URL, sslmode=require, and that the Neon database is empty or you accept overwriting conflicts."
}

Write-Host ""
Write-Host "Done. Next steps:"
Write-Host "  1. In Vercel project settings, set DATABASE_URL to Neon POOLED connection string."
Write-Host "  2. Set NEXTAUTH_URL, NEXTAUTH_SECRET, GAME_API_KEY, GAME_CORS_ORIGIN."
Write-Host "  3. Redeploy the dashboard (git push or Vercel Redeploy)."
Write-Host "  4. Verify: https://YOUR-APP.vercel.app/api/health/db"

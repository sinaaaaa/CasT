# Copy local Docker PostgreSQL -> Neon (schema + data).
#
# STEP 1 — In Neon dashboard copy DIRECT connection string (not pooled).
# STEP 2 — Run:
#   cd platform
#   $env:NEON_DATABASE_URL = "postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
#   powershell -ExecutionPolicy Bypass -File .\scripts\migrate-local-to-neon.ps1 -ReplaceExisting
#
# Prerequisite: Docker Desktop running, container sparc-assessment-db up.

param(
    [string]$NeonDatabaseUrl = $env:NEON_DATABASE_URL,
    [string]$LocalContainer = "sparc-assessment-db",
    [string]$BackupFile = "",
    [switch]$SchemaOnly,
    [switch]$ReplaceExisting
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($NeonDatabaseUrl)) {
    Write-Error @"
NEON_DATABASE_URL is not set.

Set your Neon DIRECT connection string first (Neon dashboard -> Connect -> Direct):
  `$env:NEON_DATABASE_URL = "postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
"@
}

# Fix common typo
if ($NeonDatabaseUrl -match "sslmode=requir$") {
    $NeonDatabaseUrl = "$NeonDatabaseUrl" + "e"
    Write-Host "Fixed connection string: appended missing 'e' in sslmode=require"
}

$platformRoot = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $platformRoot "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not [string]::IsNullOrWhiteSpace($BackupFile)) {
    if (-not (Test-Path $BackupFile)) {
        Write-Error "Backup file not found: $BackupFile"
    }
    $dumpFile = (Resolve-Path $BackupFile).Path
    $dumpSizeMb = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
    Write-Host "Step A: Using existing SQL backup ($dumpSizeMb MB):"
    Write-Host "  $dumpFile"
} else {
    $dumpFile = Join-Path $backupDir "sparc-full-$stamp.sql"

    Write-Host "Step A: Checking local Docker database ..."
    docker ps --format "{{.Names}}" | Select-String -Pattern "^$([regex]::Escape($LocalContainer))$" -Quiet | Out-Null
    if (-not $?) {
        Write-Host "Starting local Postgres ..."
        Push-Location $platformRoot
        docker compose up -d
        Pop-Location
        Start-Sleep -Seconds 3
    }

    Write-Host "Step B: Exporting full SQL backup to $dumpFile ..."
    $dumpArgs = @("-U", "sparc", "-d", "sparc_assessment", "--no-owner", "--no-acl")
    if ($SchemaOnly) { $dumpArgs += "--schema-only" }

    docker exec -t $LocalContainer pg_dump @dumpArgs | Set-Content -Encoding utf8 $dumpFile
    if ($LASTEXITCODE -ne 0) {
        Write-Error "pg_dump failed. Run: cd platform; docker compose up -d"
    }

    $dumpSizeMb = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
    Write-Host "Full SQL backup saved ($dumpSizeMb MB)."
}

function Invoke-NeonPsql {
    param([string[]]$PsqlArgs)

    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) {
        & psql @PsqlArgs
        return
    }

    docker run --rm postgres:16-alpine psql @PsqlArgs
}

function Invoke-NeonPsqlFile {
    param([string]$SqlFile)

    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) {
        Invoke-NeonPsql @($NeonDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-f", $SqlFile)
        return
    }

    Write-Host "Using Docker postgres client (psql not on PATH)."
    docker run --rm `
        -v "${backupDir}:/backups:ro" `
        postgres:16-alpine `
        psql $NeonDatabaseUrl -v ON_ERROR_STOP=1 -f "/backups/$(Split-Path $SqlFile -Leaf)"
}

function Get-NeonReadyBackupFile {
    param([string]$SourceFile)

    $needsSanitize = Select-String -Path $SourceFile -Pattern "OWNER TO sparc|^\\restrict" -Quiet
    if (-not $needsSanitize) {
        return $SourceFile
    }

    $dest = $SourceFile -replace '\.sql$', '-neon.sql'
    Write-Host "Sanitizing backup for Neon (strip local OWNER/grants) ..."
    Write-Host "  -> $dest"
    Get-Content -LiteralPath $SourceFile | Where-Object {
        $_ -notmatch 'OWNER TO sparc' -and
        $_ -notmatch '^\\restrict' -and
        $_ -notmatch '^\\unrestrict'
    } | Set-Content -Encoding utf8 -LiteralPath $dest
    return $dest
}

if ($ReplaceExisting -and -not $SchemaOnly) {
    Write-Host "Step C: Replacing existing Neon data (DROP SCHEMA public CASCADE) ..."
    Write-Host "WARNING: This deletes ALL data currently on Neon."
    Invoke-NeonPsql @(
        $NeonDatabaseUrl,
        "-v", "ON_ERROR_STOP=1",
        "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO neondb_owner; GRANT ALL ON SCHEMA public TO public;"
    )
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Could not reset Neon schema. Check NEON_DATABASE_URL (must be DIRECT URL with sslmode=require)."
    }
}

Write-Host "Step D: Importing dump into Neon (1-3 minutes) ..."
$importFile = Get-NeonReadyBackupFile -SourceFile $dumpFile
Invoke-NeonPsqlFile -SqlFile $importFile
if ($LASTEXITCODE -ne 0) {
    if (-not $ReplaceExisting) {
        Write-Error @"
Import failed. Neon probably already has tables from Vercel/Prisma.

Re-run with -ReplaceExisting to wipe Neon and import your local copy:
  powershell -ExecutionPolicy Bypass -File .\scripts\migrate-local-to-neon.ps1 -ReplaceExisting
"@
    }
    Write-Error "Import failed. Check NEON_DATABASE_URL and Neon dashboard."
}

Write-Host ""
Write-Host "SUCCESS - local database copied to Neon."
Write-Host ""
Write-Host "NEXT:"
Write-Host "  1. Vercel DATABASE_URL must be Neon POOLED URL (-pooler in hostname)"
Write-Host "  2. Redeploy on Vercel if needed"
Write-Host "  3. Check https://cas-t.vercel.app/api/health/db"
Write-Host "  4. Log in as teacher and confirm levels/students match local"

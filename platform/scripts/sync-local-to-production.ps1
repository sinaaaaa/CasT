# Sync ALL local changes to production (Neon database + uploads + WebGL on Vercel).
#
# Production needs THREE things:
#   1. Database (level config, audioUrl paths) -> Neon via sparc-full-*.sql backup
#   2. Audio/image files in public/uploads/     -> Git push -> Vercel deploy
#   3. Unity WebGL in public/unity/             -> Git push -> Vercel deploy
#
# Usage:
#   cd platform
#   $env:NEON_DATABASE_URL = "postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
#   powershell -ExecutionPolicy Bypass -File .\scripts\sync-local-to-production.ps1

param(
    [string]$NeonDatabaseUrl = $env:NEON_DATABASE_URL,
    [string]$BackupFile = "",
    [switch]$SkipGitPush,
    [switch]$SkipNeon,
    [switch]$SkipWebGl
)

$ErrorActionPreference = "Stop"
$platformRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $platformRoot

Push-Location $platformRoot
try {
    if (-not $SkipNeon) {
        if ([string]::IsNullOrWhiteSpace($NeonDatabaseUrl)) {
            Write-Error "Set NEON_DATABASE_URL (Neon DIRECT connection string with sslmode=require)."
        }
        Write-Host "=== 1/3 Sync database local -> Neon (full SQL backup) ===" -ForegroundColor Cyan
        $migrateScript = Join-Path $PSScriptRoot "migrate-local-to-neon.ps1"
        if (-not [string]::IsNullOrWhiteSpace($BackupFile)) {
            & powershell -ExecutionPolicy Bypass -File $migrateScript -ReplaceExisting -NeonDatabaseUrl $NeonDatabaseUrl -BackupFile $BackupFile
        } else {
            & powershell -ExecutionPolicy Bypass -File $migrateScript -ReplaceExisting -NeonDatabaseUrl $NeonDatabaseUrl
        }
    } else {
        Write-Host "Skipping Neon sync (-SkipNeon)." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "=== 2/3 Sync upload files -> GitHub (for Vercel) ===" -ForegroundColor Cyan
    Pop-Location
    Push-Location $repoRoot

    $gitPaths = @(
        "platform/public/uploads/hints",
        "platform/public/uploads/hint-audio"
    )
    if (-not $SkipWebGl) {
        $gitPaths += "platform/public/unity"
    }

    foreach ($p in $gitPaths) {
        if (Test-Path $p) {
            git add $p
        }
    }

    $staged = git diff --cached --name-only
    $assetStaged = $staged | Where-Object {
        $_ -like "platform/public/uploads/*" -or $_ -like "platform/public/unity/*"
    }

    if ($assetStaged) {
        Write-Host "New or changed production assets to push:"
        $assetStaged | ForEach-Object { Write-Host "  $_" }

        if (-not $SkipGitPush) {
            git commit -m "Sync production assets: SQL-backed DB data, uploads, and Unity WebGL build."
            git push cast main
            Write-Host "Assets pushed to GitHub. Vercel will redeploy." -ForegroundColor Green
        } else {
            Write-Host "SkipGitPush set - run git commit and git push cast main manually." -ForegroundColor Yellow
        }
    } else {
        Write-Host "No new upload/WebGL files to commit (already on GitHub)." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "DONE. Production sync checklist:" -ForegroundColor Green
    Write-Host "  - Neon restored from platform/backups/sparc-full-*.sql"
    Write-Host "  - Vercel serves uploads at https://cas-t.vercel.app/uploads/..."
    Write-Host "  - Unity WebGL at https://cas-t.vercel.app/unity/index.html"
    Write-Host "  - Student play page at https://cas-t.vercel.app/play"
}
finally {
    Pop-Location
}

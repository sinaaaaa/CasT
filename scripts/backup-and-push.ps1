# 1) Backup PostgreSQL  2) Stage source-only changes  3) Commit + push to cast/main
param(
    [string]$CommitMessage = "",
    [switch]$SkipBackup,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$platformDir = Join-Path $projectRoot "platform"

if (-not $SkipBackup) {
    Write-Host "Backing up database..."
    Push-Location $platformDir
    npm run db:backup-full
    Pop-Location
}

Push-Location $projectRoot

# Stop tracking IDE cache if it was committed before .gitignore update
git rm -r --cached ".vs" 2>$null

$paths = @(
    ".gitignore",
    "Assets/",
    "ProjectSettings/",
    "platform/",
    "scripts/",
    "webgl/"
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        git add $p
    }
}

# Unstage local-only paths even if they were touched
git reset -- platform/backups/ 2>$null
git reset -- .vs/ 2>$null

$status = git status --short
Write-Host "`nStaged for commit:"
git diff --cached --stat

if ($DryRun) {
    Write-Host "`nDry run — no commit or push."
    Pop-Location
    exit 0
}

if (-not $CommitMessage) {
    $CommitMessage = @"
Assessment UI, intro fixes, and platform updates.

Per-student intro completion, welcome audio, number-line assessment, and teacher student profile.
"@
}

git commit -m $CommitMessage
git push cast main

Write-Host "`nPushed to cast/main (https://github.com/sinaaaaa/CasT.git)"
Pop-Location

# Run with Unity CLOSED. Clears stuck Bee compiler cache and orphaned bee_backend processes.
Write-Host "Stopping bee_backend / Unity (if running)..."
Get-Process -Name "bee_backend" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "Unity" -ErrorAction SilentlyContinue | Stop-Process -Force

$projectRoot = Split-Path -Parent $PSScriptRoot
$bee = Join-Path $projectRoot "Library\Bee"
$logs = Join-Path $projectRoot "Logs"
$temp = Join-Path $projectRoot "Temp"

if (Test-Path $bee) {
    Write-Host "Removing Library\Bee ..."
    Remove-Item -Recurse -Force $bee
}
if (Test-Path $logs) {
    Write-Host "Removing Logs ..."
    Remove-Item -Recurse -Force $logs
}
if (Test-Path $temp) {
    Write-Host "Removing Temp ..."
    Remove-Item -Recurse -Force $temp
}

Write-Host "Done. Reopen the project in Unity Hub (one editor window only)."

# Run with Unity CLOSED. Clears stuck Bee compiler cache and orphaned bee_backend processes.
Write-Host "Stopping bee_backend / Unity (if running)..."
Get-Process -Name "bee_backend" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "Unity" -ErrorAction SilentlyContinue | Stop-Process -Force

$projectRoot = Split-Path -Parent $PSScriptRoot
$paths = @(
    "Library\Bee",
    "Library\PlayerDataCache\WebGL",
    "Library\BuildPlayerData\WebGL",
    "Library\Il2cppBuildCache\WebGL",
    "Library\Il2cppBuildCache\WebGLSupport",
    "Logs",
    "Temp",
    "BuildLogs"
)

foreach ($rel in $paths) {
    $full = Join-Path $projectRoot $rel
    if (Test-Path $full) {
        Write-Host "Removing $rel ..."
        Remove-Item -Recurse -Force $full
    }
}

Write-Host "Done. Reopen the project in Unity Hub (one editor window only)."
Write-Host "Then use menu: SPARC -> Build WebGL (Clean Export)"

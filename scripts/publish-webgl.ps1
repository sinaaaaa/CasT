# Builds Unity WebGL into platform/public/unity (served at /unity/index.html).
param(
    [string]$UnityVersion = "2022.3.11f1"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$unityExe = "C:\Program Files\Unity\Hub\Editor\$UnityVersion\Editor\Unity.exe"

if (-not (Test-Path $unityExe)) {
    Write-Error "Unity $UnityVersion not found at $unityExe"
}

$logDir = Join-Path $projectRoot "BuildLogs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "webgl-build.log"

Write-Host "Building WebGL -> platform/public/unity ..."
Write-Host "Log: $logFile"

& $unityExe `
    -quit `
    -batchmode `
    -nographics `
    -projectPath $projectRoot `
    -executeMethod WebGLBuildScript.Build `
    -logFile $logFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Unity WebGL build failed (exit $LASTEXITCODE). See $logFile"
}

Write-Host "WebGL build complete."
Write-Host "Local test: cd platform; npm run dev -> http://localhost:3000/student/play"

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$dbPath = Join-Path $projectRoot "app\data\produccion\biomed.db"
$backupDir = Join-Path $projectRoot "backups"

if (-not (Test-Path $dbPath)) {
    Write-Host "No existe una base de datos de produccion en: $dbPath" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDir "biomed-$stamp.db"
Copy-Item -Path $dbPath -Destination $backupPath

Write-Host "Backup creado correctamente:" -ForegroundColor Green
Write-Host $backupPath

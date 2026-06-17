$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$dbDir = Join-Path $projectRoot "app\data\produccion"
$dbPath = Join-Path $dbDir "biomed.db"

New-Item -ItemType Directory -Force $dbDir | Out-Null

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host ""
    Write-Host "No se encontro Python instalado." -ForegroundColor Red
    Write-Host "Instale Python 3 desde https://www.python.org/downloads/ y marque la opcion 'Add python.exe to PATH'."
    exit 1
}

$env:BIOMED_HOST = "0.0.0.0"
$env:BIOMED_PORT = "8000"
$env:BIOMED_DB_PATH = $dbPath
$env:BIOMED_SEED_DEMO = "0"

$localUrl = "http://127.0.0.1:8000"
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -ExpandProperty IPAddress

Write-Host ""
Write-Host "Sistema de Gestion Biomedica - Produccion" -ForegroundColor Cyan
Write-Host "Base de datos: $dbPath"
Write-Host "Abrir en este equipo: $localUrl" -ForegroundColor Green
foreach ($ip in $ips) {
    Write-Host "Abrir desde otro equipo de la misma red: http://$ip`:8000" -ForegroundColor Green
}
Write-Host ""
Write-Host "IMPORTANTE: No cierre esta ventana mientras el sistema este en uso."
Write-Host "Para detener el sistema, presione Ctrl + C y confirme."
Write-Host ""

Start-Process $localUrl
python (Join-Path $projectRoot "app\server.py")

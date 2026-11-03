# Creates / upgrades the database using DATABASE_URL from api\settings.env and the
# SQL scripts in the database\ folder next to api\. Called by api\setup-database.cmd.
#   -Sample  also loads the demo data
param([switch]$Sample)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot          # api\
$SqlDir = Join-Path (Split-Path -Parent $Root) "database"

if (-not (Test-Path (Join-Path $SqlDir "full-database.sql"))) {
    Write-Host "Can't find ..\database\full-database.sql next to the api folder." -ForegroundColor Red
    Write-Host "Copy the database folder next to api, or run full-database.sql in SQL Server Management Studio." -ForegroundColor Yellow
    exit 1
}

$url = $null
foreach ($line in [IO.File]::ReadAllLines((Join-Path $Root "settings.env"))) {
    if ($line -match '^\s*DATABASE_URL\s*=\s*(.*?)\s*$') { $url = $Matches[1].Trim('"').Trim("'") }
}
if (-not $url -or $url -match "Password=CHANGE-ME") {
    Write-Host "Set DATABASE_URL in api\settings.env first (see README.txt)." -ForegroundColor Red
    exit 1
}

$env:DATABASE_URL = $url
$env:DB_SCRIPTS_DIR = $SqlDir
$node = Join-Path $Root "runtime\node.exe"
$script = Join-Path $PSScriptRoot "tools\init-db.js"
if ($Sample) { & $node $script --sample } else { & $node $script }
exit $LASTEXITCODE

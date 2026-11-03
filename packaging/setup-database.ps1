# Creates / upgrades the database using DATABASE_URL from settings.env.
# Called by setup-database.cmd.   -Sample  also loads the demo data.
param([switch]$Sample)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

$url = $null
foreach ($line in [IO.File]::ReadAllLines((Join-Path $Root "settings.env"))) {
    if ($line -match '^\s*DATABASE_URL\s*=\s*(.*?)\s*$') { $url = $Matches[1].Trim('"').Trim("'") }
}
if (-not $url -or $url -match "Password=CHANGE-ME") {
    Write-Host "Set DATABASE_URL in settings.env first (see README.txt)." -ForegroundColor Red
    exit 1
}

$env:DATABASE_URL = $url
$node = Join-Path $Root "runtime\node.exe"
$script = Join-Path $Root "database\init-db.js"
if ($Sample) { & $node $script --sample } else { & $node $script }
exit $LASTEXITCODE

# Starts the production server. Used by the Windows startup task (see deploy.ps1),
# but you can also run it by hand:  powershell -ExecutionPolicy Bypass -File scripts\run-server.ps1
#
# - reads PORT and DATABASE_URL from .env
# - waits (up to 5 minutes) for SQL Server to accept connections, so after a reboot
#   the app never starts before the database is ready
# - writes output to logs\server.log

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir "server.log"

# Keep the log from growing forever: roll over at 10 MB
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 10MB)) {
    Move-Item -Force $Log (Join-Path $LogDir "server.old.log")
}

function Write-Log($msg) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File -FilePath $Log -Append -Encoding utf8
}

# --- read .env ----------------------------------------------------------
$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) { Write-Log "ERROR: .env not found in $Root"; exit 1 }
$cfg = @{}
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
        $cfg[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
$Port = if ($cfg["PORT"]) { $cfg["PORT"] } else { "3000" }

# --- wait for SQL Server -------------------------------------------------
$dbHost = $null; $dbPort = 1433
if ($cfg["DATABASE_URL"] -match '(?i)(?:Server|Data Source)\s*=\s*([^;]+)') {
    $server = $Matches[1].Trim() -replace '^tcp:', ''
    if ($server -match ',(\d+)$') { $dbPort = [int]$Matches[1]; $server = $server -replace ',\d+$', '' }
    if ($server -notmatch '\\') { $dbHost = $server }   # named instances use dynamic ports: skip the check
} elseif ($cfg["DATABASE_URL"] -match '^mssql://[^@]*@([^:/]+)(?::(\d+))?') {
    $dbHost = $Matches[1]; if ($Matches[2]) { $dbPort = [int]$Matches[2] }
}
if ($dbHost) {
    if ($dbHost -in @(".", "(local)")) { $dbHost = "localhost" }
    $deadline = (Get-Date).AddMinutes(5)
    while ($true) {
        $ok = $false
        try { $c = New-Object Net.Sockets.TcpClient; $c.Connect($dbHost, $dbPort); $ok = $c.Connected; $c.Close() } catch {}
        if ($ok) { break }
        if ((Get-Date) -gt $deadline) { Write-Log "WARNING: SQL Server $($dbHost):$dbPort not reachable after 5 minutes; starting anyway"; break }
        Start-Sleep -Seconds 5
    }
}

# --- start Next.js -------------------------------------------------------
if (-not (Test-Path (Join-Path $Root ".next\BUILD_ID"))) {
    Write-Log "ERROR: no production build found. Run scripts\deploy.ps1 (or npm run build) first."
    exit 1
}
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = "C:\Program Files\nodejs\node.exe" }

Write-Log "Starting server on port $Port"
$env:NODE_ENV = "production"
# Absolute path to Next so deploy.ps1 can recognise (and stop) this process by its command line.
# cmd handles the redirection so the log stays plain UTF-8 text.
$nextBin = Join-Path $Root "node_modules\next\dist\bin\next"
cmd /c "`"$node`" `"$nextBin`" start -p $Port >> `"$Log`" 2>&1"
$code = $LASTEXITCODE
Write-Log "Server exited with code $code"
exit $code

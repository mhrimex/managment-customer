# Starts the Client Management Portal from this folder.
#   start.cmd               -> runs it in a window (close the window to stop)
#   install-service.cmd     -> runs it automatically with Windows (uses this script)
#
# - reads settings.env
# - first start: replaces AUTH_SECRET / ENCRYPTION_SECRET placeholders with random values
# - waits up to 5 minutes for SQL Server (so it never starts before the database after a reboot)
# - runs the app with the bundled Node.js (runtime\node.exe)
param([switch]$Console)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir "server.log"
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 10MB)) { Move-Item -Force $Log (Join-Path $LogDir "server.old.log") }

function Say($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    if ($Console) { Write-Host $line } else { $line | Out-File -FilePath $Log -Append -Encoding utf8 }
}
function Stop-WithError($msg) { Say "ERROR: $msg"; if ($Console) { Read-Host "Press Enter to close" | Out-Null }; exit 1 }

$node = Join-Path $Root "runtime\node.exe"
$server = Join-Path $Root "app\server.js"
if (-not (Test-Path $node))   { Stop-WithError "runtime\node.exe is missing. Copy the whole deployment folder." }
if (-not (Test-Path $server)) { Stop-WithError "app\server.js is missing. Copy the whole deployment folder." }

# --- settings.env ---------------------------------------------------------
$settingsFile = Join-Path $Root "settings.env"
if (-not (Test-Path $settingsFile)) { Stop-WithError "settings.env not found in $Root" }
$utf8 = New-Object Text.UTF8Encoding $false

# First start: generate secrets in place
$text = [IO.File]::ReadAllText($settingsFile)
$changed = $false
foreach ($key in @("AUTH_SECRET", "ENCRYPTION_SECRET")) {
    $pattern = "(?m)^([ \t]*$key[ \t]*=[ \t]*)`"?(generate-on-first-start|change-me[^`"\r\n]*)?`"?[ \t]*(?=\r?$)"
    if ($text -match $pattern) {
        $secret = (& $node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))")
        $text = [regex]::Replace($text, $pattern, "`${1}`"$secret`"")
        $changed = $true
        Say "Generated a new $key in settings.env"
    }
}
if ($changed) {
    [IO.File]::WriteAllText($settingsFile, $text, $utf8)
    Say "IMPORTANT: back up ENCRYPTION_SECRET from settings.env (password manager)."
}

$cfg = @{}
foreach ($line in [IO.File]::ReadAllLines($settingsFile)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        $cfg[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
}
if (-not $cfg["DATABASE_URL"] -or $cfg["DATABASE_URL"] -match "Password=CHANGE-ME") {
    Stop-WithError "Set DATABASE_URL in settings.env first."
}
$port = if ($cfg["PORT"]) { $cfg["PORT"] } else { "3000" }

# --- wait for SQL Server --------------------------------------------------
$dbHost = $null; $dbPort = 1433
if ($cfg["DATABASE_URL"] -match '(?i)(?:Server|Data Source)\s*=\s*([^;]+)') {
    $srv = $Matches[1].Trim() -replace '^tcp:', ''
    if ($srv -match ',(\d+)$') { $dbPort = [int]$Matches[1]; $srv = $srv -replace ',\d+$', '' }
    if ($srv -notmatch '\\') { $dbHost = $srv }   # named instance: dynamic port, skip the check
} elseif ($cfg["DATABASE_URL"] -match '^mssql://[^@]*@([^:/]+)(?::(\d+))?') {
    $dbHost = $Matches[1]; if ($Matches[2]) { $dbPort = [int]$Matches[2] }
}
if ($dbHost) {
    if ($dbHost -in @(".", "(local)")) { $dbHost = "localhost" }
    $deadline = (Get-Date).AddMinutes(5); $first = $true
    while ($true) {
        $ok = $false
        try { $c = New-Object Net.Sockets.TcpClient; $c.Connect($dbHost, $dbPort); $ok = $c.Connected; $c.Close() } catch {}
        if ($ok) { break }
        if ($first) { Say "Waiting for SQL Server at $($dbHost):$dbPort ..."; $first = $false }
        if ((Get-Date) -gt $deadline) { Say "WARNING: SQL Server not reachable after 5 minutes; starting anyway"; break }
        Start-Sleep -Seconds 5
    }
}

# --- start ----------------------------------------------------------------
foreach ($k in $cfg.Keys) { if ($cfg[$k] -ne "") { [Environment]::SetEnvironmentVariable($k, $cfg[$k], "Process") } }
$env:NODE_ENV = "production"
$env:PORT = $port
$env:HOSTNAME = "0.0.0.0"   # listen on all network cards (other PCs can connect)

Say "Starting on port $port"
if ($Console) {
    Write-Host "Open http://localhost:$port   (close this window to stop the app)" -ForegroundColor Green
    & $node $server
} else {
    # cmd does the redirection so the log stays plain UTF-8
    cmd /c "`"$node`" `"$server`" >> `"$Log`" 2>&1"
}
$code = $LASTEXITCODE
Say "App stopped (exit code $code)"
exit $code

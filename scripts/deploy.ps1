<#
  One-command deployment for Windows.

  First install AND every update:   (right-click PowerShell -> "Run as administrator")
      cd "C:\path\to\customer managment"
      powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1

  What it does:
      1. checks Node.js and .env (creates .env with fresh secrets on first run)
      2. stops the running app
      3. installs packages (npm ci)
      4. creates / updates the database (npm run db:init)
      5. builds the production version (npm run build)
      6. registers a Windows startup task so the app starts with Windows and
         restarts itself if it crashes (needs administrator), then starts it
      7. prints the addresses to open

  Options:
      -SampleData     also load demo clients/servers/deployments (not for real use)
      -SkipDb         don't touch the database
      -OpenFirewall   allow other PCs on the network to reach the app (needs admin)
      -NoService      don't register the startup task; just start the app now
      -Uninstall      remove the startup task + firewall rule and stop the app
#>
param(
    [switch]$SampleData,
    [switch]$SkipDb,
    [switch]$OpenFirewall,
    [switch]$NoService,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$TaskName = "ClientManagementPortal"
$FirewallRule = "Client Management Portal"
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }
function NewSecret  { & node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" }

function Read-Env {
    $cfg = @{}
    if (Test-Path ".env") {
        foreach ($line in Get-Content ".env") {
            if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
                $cfg[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
            }
        }
    }
    return $cfg
}

function Stop-App {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop } catch { Warn "Could not stop task (run as administrator): $($_.Exception.Message)" }
    }
    # The task's child node.exe can outlive the task, so stop it directly:
    # any "next start" from this folder, plus whatever node.exe is listening on our port.
    $port = (Read-Env)["PORT"]; if (-not $port) { $port = "3000" }
    $portPids = @(Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess)
    $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -and (
            ($_.CommandLine.Contains($Root) -and $_.CommandLine.Contains("next")) -or
            ($portPids -contains $_.ProcessId -and $_.CommandLine.Contains("next")) ) }
    foreach ($p in $procs) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Ok "Stopped running app (PID $($p.ProcessId))" }
        catch { Fail "The app is running as another user (PID $($p.ProcessId)). Run this script as administrator." }
    }
}

# --------------------------------------------------------------------------
if ($Uninstall) {
    if (-not $IsAdmin) { Fail "Run as administrator to uninstall." }
    Step "Removing startup task, firewall rule and stopping the app"
    Stop-App
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false; Ok "Startup task removed"
    }
    Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Ok "Done. Your database and files were not touched."
    exit 0
}

# --------------------------------------------------------------------------
Step "Checking Node.js"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Fail "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again." }
$ver = (& node -v).TrimStart("v").Split(".")
if ([int]$ver[0] -lt 18 -or ([int]$ver[0] -eq 18 -and [int]$ver[1] -lt 18)) { Fail "Node.js 18.18 or newer is required (found v$($ver -join '.'))." }
Ok "Node.js v$($ver -join '.')"

# --------------------------------------------------------------------------
Step "Checking configuration (.env)"
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    $text = Get-Content ".env" -Raw
    $text = $text -replace 'AUTH_SECRET="change-me-to-a-long-random-string"', "AUTH_SECRET=`"$(NewSecret)`""
    $text = $text -replace 'ENCRYPTION_SECRET="change-me-to-a-long-random-string"', "ENCRYPTION_SECRET=`"$(NewSecret)`""
    [IO.File]::WriteAllText((Join-Path $Root ".env"), $text, (New-Object Text.UTF8Encoding $false))
    Warn "Created .env with new random AUTH_SECRET and ENCRYPTION_SECRET."
    Warn "Now open .env, set DATABASE_URL to your SQL Server, save, and run this script again."
    Warn "Back up the ENCRYPTION_SECRET value somewhere safe (password manager)."
    exit 1
}
$cfg = Read-Env
if (-not $cfg["DATABASE_URL"]) { Fail "DATABASE_URL is missing in .env" }
if (-not $cfg["AUTH_SECRET"] -or $cfg["AUTH_SECRET"] -like "change-me*") { Fail "Set AUTH_SECRET in .env (generate: node -e `"console.log(require('crypto').randomBytes(48).toString('base64url'))`")" }
if (-not $cfg["ENCRYPTION_SECRET"] -or $cfg["ENCRYPTION_SECRET"] -like "change-me*") { Fail "Set ENCRYPTION_SECRET in .env (same command as above). Never change it after storing vault passwords." }
if ($cfg["NODE_ENV"] -and $cfg["NODE_ENV"] -ne "production") { Fail "Remove or comment out NODE_ENV=$($cfg["NODE_ENV"]) in .env (npm sets it automatically)." }
$Port = if ($cfg["PORT"]) { $cfg["PORT"] } else { "3000" }
Ok ".env looks good (port $Port)"

# --------------------------------------------------------------------------
Step "Stopping the running app (if any)"
Stop-App

Step "Installing packages"
& npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm ci failed" }

if (-not $SkipDb) {
    Step "Creating / updating the database"
    if ($SampleData) { & npm run db:seed-sample } else { & npm run db:init }
    if ($LASTEXITCODE -ne 0) { Fail "Database setup failed. Check DATABASE_URL in .env and that SQL Server is running." }
}

Step "Building the production version"
& npm run build
if ($LASTEXITCODE -ne 0) { Fail "Build failed" }

# --------------------------------------------------------------------------
$runner = Join-Path $Root "scripts\run-server.ps1"
if (-not $NoService -and $IsAdmin) {
    Step "Registering Windows startup task '$TaskName'"
    $action    = New-ScheduledTaskAction -Execute "powershell.exe" `
                   -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`"" -WorkingDirectory $Root
    $trigger   = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                   -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
                   -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal `
        -Settings $settings -Description "Client Management Portal (Next.js) - $Root" -Force | Out-Null
    Ok "Starts automatically with Windows and restarts if it crashes"
    Start-ScheduledTask -TaskName $TaskName
} else {
    if (-not $NoService) { Warn "Not running as administrator: skipped the startup task. The app will NOT start after a reboot." }
    Step "Starting the app"
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$runner`""
}

if ($OpenFirewall) {
    if ($IsAdmin) {
        Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        New-NetFirewallRule -DisplayName $FirewallRule -Direction Inbound -Protocol TCP -LocalPort $Port `
            -Action Allow -Profile Domain,Private | Out-Null
        Ok "Firewall: port $Port open for Domain/Private networks"
    } else { Warn "Run as administrator to open the firewall." }
}

# --------------------------------------------------------------------------
Step "Waiting for the app to answer"
$up = $false
for ($i = 0; $i -lt 60; $i++) {
    try { $r = Invoke-WebRequest "http://localhost:$Port/login" -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { $up = $true; break } } catch {}
    Start-Sleep -Seconds 2
}
if (-not $up) { Fail "The app did not start. See logs\server.log" }

Write-Host "`nDeployed." -ForegroundColor Green
Write-Host "  This PC:      http://localhost:$Port"
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    ForEach-Object { Write-Host "  Other PCs:    http://$($_.IPAddress):$Port" }
Write-Host "  Log file:     $Root\logs\server.log"
Write-Host "  First login:  admin@agency.com / Admin123!  -> change it on the Users page"

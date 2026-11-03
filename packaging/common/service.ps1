# Windows startup task for one part of the Client Management Portal (run as administrator).
# Lives in <part>\bin\. Called by the .cmd files in <part>\:
#   install-service.cmd     -> register + start; opens the firewall port when the part
#                              listens on the network (application always; api only if HOST
#                              in settings.env is not 127.0.0.1)
#   restart-service.cmd     -> restart after changing settings.env
#   uninstall-service.cmd   -> stop + remove (files, settings and database are kept)
param(
    [ValidateSet("install", "uninstall", "restart")][string]$Action = "install",
    [Parameter(Mandatory = $true)][string]$Name,
    [switch]$NoFirewall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$FirewallRule = "Client Management Portal - $Name"

function Ok($m)   { Write-Host "  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail "Right-click the .cmd file and choose 'Run as administrator'." }

$cfg = @{}
foreach ($l in Get-Content (Join-Path $Root "settings.env")) {
    if ($l -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim('"').Trim("'") }
}
$port = if ($cfg["PORT"]) { $cfg["PORT"] } else { "3000" }
$bind = if ($cfg["HOST"]) { $cfg["HOST"] } else { "0.0.0.0" }
$networkFacing = $bind -notin @("127.0.0.1", "localhost", "::1")

function Stop-App {
    if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    }
    # The task's node.exe child can outlive the task: stop the one running from THIS folder.
    $node = Join-Path $Root "runtime\node.exe"
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $node) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Ok "Stopped running $Name (PID $($_.ProcessId))" }
}

function Wait-Up {
    $hostToCheck = if ($networkFacing) { "localhost" } else { $bind }
    for ($i = 0; $i -lt 45; $i++) {
        try {
            Invoke-WebRequest "http://$($hostToCheck):$port/" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 | Out-Null
            return $true
        } catch {
            # any HTTP answer (404, 307, 401...) means the server is up
            if ($_.Exception.Response) { return $true }
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

switch ($Action) {
    "uninstall" {
        Stop-App
        if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $Name -Confirm:$false; Ok "Startup task '$Name' removed"
        }
        Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        Ok "Done. Files, settings and database were not touched."
        exit 0
    }
    "restart" {
        if (-not (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue)) { Fail "Not installed. Run install-service.cmd first." }
        Stop-App
        Start-ScheduledTask -TaskName $Name
    }
    "install" {
        Stop-App
        $runner = Join-Path $PSScriptRoot "run-server.ps1"
        $action    = New-ScheduledTaskAction -Execute "powershell.exe" `
                       -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`"" -WorkingDirectory $Root
        $trigger   = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                       -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
                       -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal `
            -Settings $settings -Description "Client Management Portal ($Name) - $Root" -Force | Out-Null
        Ok "Startup task '$Name' registered (starts with Windows, restarts if it crashes)"

        Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        if ($networkFacing -and -not $NoFirewall) {
            New-NetFirewallRule -DisplayName $FirewallRule -Direction Inbound -Protocol TCP -LocalPort $port `
                -Action Allow -Profile Domain,Private | Out-Null
            Ok "Firewall: port $port open for Domain/Private networks"
        } elseif (-not $networkFacing) {
            Ok "Listening on $bind only (this machine) - no firewall rule needed"
        }
        Start-ScheduledTask -TaskName $Name
    }
}

Write-Host "  Waiting for $Name..."
if (Wait-Up) {
    $shown = if ($networkFacing) { "localhost" } else { $bind }
    Ok "Running:  http://$($shown):$port"
    if ($networkFacing) {
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
            ForEach-Object { Ok "Other PCs: http://$($_.IPAddress):$port" }
    }
} else {
    Warn "Not answering yet. Check logs\server.log"
}

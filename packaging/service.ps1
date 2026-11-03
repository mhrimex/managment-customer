# Windows startup task for the Client Management Portal (run as administrator).
#   install-service.cmd     -> register + start + open the port in Windows Firewall
#                              (install-service.cmd -NoFirewall to skip the firewall rule)
#   restart-service.cmd     -> restart after changing settings.env
#   uninstall-service.cmd   -> stop + remove (files and database are kept)
param(
    [ValidateSet("install", "uninstall", "restart")][string]$Action = "install",
    [switch]$NoFirewall
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$TaskName = "ClientManagementPortal"
$FirewallRule = "Client Management Portal"

function Ok($m)   { Write-Host "  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail "Right-click the .cmd file and choose 'Run as administrator'." }

function Get-Port {
    foreach ($l in Get-Content (Join-Path $Root "settings.env")) {
        if ($l -match '^\s*PORT\s*=\s*"?(\d+)"?\s*$') { return $Matches[1] }
    }
    return "3000"
}

function Stop-App {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    }
    # The task's node.exe child can outlive the task: stop the one running from THIS folder.
    $node = Join-Path $Root "runtime\node.exe"
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $node) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Ok "Stopped running app (PID $($_.ProcessId))" }
}

function Wait-Up($port) {
    for ($i = 0; $i -lt 45; $i++) {
        try {
            $r = Invoke-WebRequest "http://localhost:$port/login" -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) { return $true }
        } catch {}
        Start-Sleep -Seconds 2
    }
    return $false
}

$port = Get-Port

switch ($Action) {
    "uninstall" {
        Stop-App
        if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false; Ok "Startup task removed"
        }
        Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        Ok "Done. Files, settings and database were not touched."
        exit 0
    }
    "restart" {
        if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) { Fail "Not installed. Run install-service.cmd first." }
        Stop-App
        Start-ScheduledTask -TaskName $TaskName
    }
    "install" {
        Stop-App
        $runner = Join-Path $Root "run-server.ps1"
        $action    = New-ScheduledTaskAction -Execute "powershell.exe" `
                       -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`"" -WorkingDirectory $Root
        $trigger   = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                       -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
                       -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal `
            -Settings $settings -Description "Client Management Portal - $Root" -Force | Out-Null
        Ok "Startup task '$TaskName' registered (starts with Windows, restarts if it crashes)"

        if (-not $NoFirewall) {
            Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
            New-NetFirewallRule -DisplayName $FirewallRule -Direction Inbound -Protocol TCP -LocalPort $port `
                -Action Allow -Profile Domain,Private | Out-Null
            Ok "Firewall: port $port open for Domain/Private networks"
        }
        Start-ScheduledTask -TaskName $TaskName
    }
}

Write-Host "  Waiting for the app..."
if (Wait-Up $port) {
    Ok "Running:  http://localhost:$port"
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
        ForEach-Object { Ok "Other PCs: http://$($_.IPAddress):$port" }
} else {
    Warn "The app did not answer yet. Check logs\server.log"
}

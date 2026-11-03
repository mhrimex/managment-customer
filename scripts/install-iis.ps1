<#
  Deploys the Client Management Portal package to IIS in one go.
  Run in PowerShell AS ADMINISTRATOR on the IIS server:

      powershell -ExecutionPolicy Bypass -File install-iis.ps1
      powershell -ExecutionPolicy Bypass -File install-iis.ps1 -WebPort 8080 -ApiPort 5050

  Asks for anything not given. Safe to run again (updates in place, keeps settings.env).

  Parameters
    -Source     the deployment folder (with api\, application\, database\)
                default: ..\..\deployment next to the project, or the folder this script is in
    -Target     where IIS serves it from            (default C:\inetpub\ClientPortal)
    -WebPort    website port people open            (asked if missing)
    -ApiPort    API port, bound to 127.0.0.1 only   (asked if missing)
    -HostName   optional host name for the website binding (e.g. portal.company.com)
#>
param(
    [string]$Source,
    [string]$Target = "C:\inetpub\ClientPortal",
    [int]$WebPort,
    [int]$ApiPort,
    [string]$HostName = ""
)

$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "`nERROR: $m" -ForegroundColor Red; exit 1 }

$WebSite = "ClientPortal-Web"; $ApiSite = "ClientPortal-API"

# --- checks ---------------------------------------------------------------------
Step "Checking requirements"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail "Run PowerShell as Administrator (right-click -> Run as administrator)." }

if (-not (Get-Module -ListAvailable -Name WebAdministration)) {
    Fail "IIS is not installed. Turn on 'Internet Information Services' in Windows Features (or Server Manager)."
}
Import-Module WebAdministration
if (-not (Get-WebGlobalModule -Name "AspNetCoreModuleV2" -ErrorAction SilentlyContinue)) {
    Fail ("The ASP.NET Core Module V2 is missing. Install the '.NET Hosting Bundle' from " +
          "https://dotnet.microsoft.com/download/dotnet (any version 6+), run 'iisreset', then run this again.")
}
Ok "IIS and ASP.NET Core Module V2 found"

if (-not $Source) {
    $candidates = @(
        (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "deployment"),
        $PSScriptRoot,
        (Join-Path $PSScriptRoot "deployment")
    )
    $Source = $candidates | Where-Object { Test-Path (Join-Path $_ "application\web.config") } | Select-Object -First 1
}
if (-not $Source -or -not (Test-Path (Join-Path $Source "application\web.config")) -or -not (Test-Path (Join-Path $Source "api\web.config"))) {
    Fail "Can't find the deployment folder (with api\ and application\). Use -Source <folder>."
}
$Source = (Resolve-Path $Source).Path
Ok "Package: $Source"

# --- ports ------------------------------------------------------------------------
function Ask-Port($label, $suggest) {
    while ($true) {
        $v = Read-Host "$label port (Enter = $suggest)"
        if (-not $v) { return $suggest }
        if ($v -match '^\d+$' -and [int]$v -ge 1 -and [int]$v -le 65535) { return [int]$v }
        Warn "Enter a number between 1 and 65535"
    }
}
function Get-SitePort($site) {
    $b = Get-WebBinding -Name $site -Protocol http -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($b) { return [int](($b.bindingInformation -split ":")[1]) } else { return $null }
}
if (-not $WebPort) { $cur = Get-SitePort $WebSite; $WebPort = Ask-Port "Website" $(if ($cur) { $cur } else { 8080 }) }
if (-not $ApiPort) { $cur = Get-SitePort $ApiSite; $ApiPort = Ask-Port "API (this server only)" $(if ($cur) { $cur } else { 5050 }) }
if ($WebPort -eq $ApiPort) { Fail "Website and API need different ports." }

# Port used by another IIS site?
foreach ($pair in @(@($WebPort, $WebSite), @($ApiPort, $ApiSite))) {
    $other = Get-Website | Where-Object { $_.Name -ne $pair[1] } |
        Where-Object { (Get-WebBinding -Name $_.Name -Protocol http) | Where-Object { ($_.bindingInformation -split ":")[1] -eq "$($pair[0])" } }
    if ($other) { Fail "Port $($pair[0]) is already used by IIS site '$($other[0].Name)'. Choose another port." }
}
Ok "Website port $WebPort, API port $ApiPort (127.0.0.1)"

# --- stop existing ----------------------------------------------------------------
Step "Stopping existing sites (if any)"
foreach ($n in @($WebSite, $ApiSite)) {
    if (Get-Website -Name $n -ErrorAction SilentlyContinue) { Stop-Website -Name $n -ErrorAction SilentlyContinue }
    if (Test-Path "IIS:\AppPools\$n") {
        if ((Get-WebAppPoolState -Name $n).Value -ne "Stopped") { Stop-WebAppPool -Name $n -ErrorAction SilentlyContinue }
    }
}
# wait for node.exe of previous runs to exit (they hold files in bin\)
Start-Sleep -Seconds 3
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Target, [StringComparison]::OrdinalIgnoreCase) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# --- copy files -------------------------------------------------------------------
Step "Copying files to $Target"
New-Item -ItemType Directory -Force -Path $Target | Out-Null
foreach ($part in @("database", "api", "application")) {
    $src = Join-Path $Source $part; $dst = Join-Path $Target $part
    # mirror, but never overwrite or delete settings.env / logs on the server
    robocopy $src $dst /MIR /XF settings.env /XD logs /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "Copying $part failed (robocopy code $LASTEXITCODE)" }
    $settings = Join-Path $dst "settings.env"
    if ((Test-Path (Join-Path $src "settings.env")) -and -not (Test-Path $settings)) {
        Copy-Item (Join-Path $src "settings.env") $settings
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $dst "logs") -ErrorAction SilentlyContinue | Out-Null
}
Ok "Files copied (existing settings.env kept)"

# --- settings -----------------------------------------------------------------------
Step "Settings"
$utf8 = New-Object Text.UTF8Encoding $false
$apiSettings = Join-Path $Target "api\settings.env"
$apiText = [IO.File]::ReadAllText($apiSettings)
if ($apiText -match "Password=CHANGE-ME") {
    Write-Host "    The API needs your SQL Server login (saved only in $apiSettings)."
    $sqlServer = Read-Host "    SQL Server (Enter = localhost)"; if (-not $sqlServer) { $sqlServer = "localhost" }
    $sqlDb     = Read-Host "    Database   (Enter = client_management_db)"; if (-not $sqlDb) { $sqlDb = "client_management_db" }
    $sqlUser   = Read-Host "    SQL login  (e.g. sa or app_user)"
    $sec       = Read-Host "    Password" -AsSecureString
    $sqlPass   = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if ($sqlPass -match '[;"]') { $sqlPass = "{" + $sqlPass + "}" }
    $url = "`"Server=$sqlServer;Database=$sqlDb;User Id=$sqlUser;Password=$sqlPass;TrustServerCertificate=true;Encrypt=false`""
    $lines = [IO.File]::ReadAllLines($apiSettings) | ForEach-Object { if ($_ -match '^\s*DATABASE_URL\s*=') { "DATABASE_URL=$url" } else { $_ } }
    [IO.File]::WriteAllLines($apiSettings, [string[]]$lines, $utf8)
    Ok "DATABASE_URL saved"
} else {
    Ok "DATABASE_URL already set (kept)"
}

$webSettings = Join-Path $Target "application\settings.env"
$lines = [IO.File]::ReadAllLines($webSettings) | ForEach-Object { if ($_ -match '^\s*API_URL\s*=') { "API_URL=http://127.0.0.1:$ApiPort" } else { $_ } }
[IO.File]::WriteAllLines($webSettings, [string[]]$lines, $utf8)
Ok "Application -> API_URL=http://127.0.0.1:$ApiPort"

# --- app pools + sites ----------------------------------------------------------------
Step "Creating / updating IIS app pools and sites"
foreach ($n in @($ApiSite, $WebSite)) {
    if (-not (Test-Path "IIS:\AppPools\$n")) { New-WebAppPool -Name $n | Out-Null }
    Set-ItemProperty "IIS:\AppPools\$n" -Name managedRuntimeVersion -Value ""            # No Managed Code
    Set-ItemProperty "IIS:\AppPools\$n" -Name startMode -Value "AlwaysRunning"
    Set-ItemProperty "IIS:\AppPools\$n" -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)  # don't stop when idle
}
Ok "App pools: $ApiSite, $WebSite (No Managed Code, always running)"

function Ensure-Site($name, $path, $ip, $port, $hostHeader) {
    $binding = "$($ip):$($port):$hostHeader"
    if (Get-Website -Name $name -ErrorAction SilentlyContinue) {
        Set-ItemProperty "IIS:\Sites\$name" -Name physicalPath -Value $path
        Set-ItemProperty "IIS:\Sites\$name" -Name applicationPool -Value $name
        # replace the http binding(s) with ours, keep any https bindings you added
        Get-WebBinding -Name $name -Protocol http | ForEach-Object { Remove-WebBinding -Name $name -BindingInformation $_.bindingInformation -Protocol http }
        New-WebBinding -Name $name -Protocol http -IPAddress $ip -Port $port -HostHeader $hostHeader | Out-Null
    } else {
        New-Website -Name $name -PhysicalPath $path -ApplicationPool $name -IPAddress $ip -Port $port -HostHeader $hostHeader | Out-Null
    }
    Ok "$name -> http://$binding  ($path)"
}
Ensure-Site $ApiSite (Join-Path $Target "api") "127.0.0.1" $ApiPort ""
Ensure-Site $WebSite (Join-Path $Target "application") "*" $WebPort $HostName

# --- permissions -----------------------------------------------------------------------
Step "Folder permissions"
foreach ($pair in @(@("api", $ApiSite), @("application", $WebSite))) {
    $dir = Join-Path $Target $pair[0]; $who = "IIS AppPool\$($pair[1])"
    icacls $dir /grant "$($who):(OI)(CI)RX" /T /C /Q | Out-Null
    icacls (Join-Path $dir "logs") /grant "$($who):(OI)(CI)M" /T /C /Q | Out-Null
    icacls (Join-Path $dir "settings.env") /grant "$($who):M" /C /Q | Out-Null
}
Ok "App pools can read their folder and write logs\ and settings.env"

# --- firewall ----------------------------------------------------------------------------
Step "Firewall"
$rule = "Client Management Portal - website"
Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $WebPort -Action Allow -Profile Domain,Private | Out-Null
Ok "Port $WebPort open for Domain/Private networks (API port stays closed: it is 127.0.0.1 only)"

# --- start + check -------------------------------------------------------------------------
Step "Starting"
foreach ($n in @($ApiSite, $WebSite)) { Start-WebAppPool -Name $n -ErrorAction SilentlyContinue; Start-Website -Name $n }

function Test-Url($url, [int[]]$okCodes) {
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 0
            if ($okCodes -contains [int]$r.StatusCode) { return [int]$r.StatusCode }
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -and ($okCodes -contains [int]$code)) { return [int]$code }
        }
        Start-Sleep -Seconds 3
    }
    return $null
}
$apiCode = Test-Url "http://127.0.0.1:$ApiPort/api/auth/me" @(401)
if ($apiCode) { Ok "API answers (http://127.0.0.1:$ApiPort)" } else { Warn "API did not answer - see $Target\api\logs\stdout_*.log" }
$webHost = if ($HostName) { $HostName } else { "localhost" }
$webCode = Test-Url "http://127.0.0.1:$WebPort/login" @(200, 307)
if ($webCode) { Ok "Website answers" } else { Warn "Website did not answer - see $Target\application\logs\stdout_*.log" }

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  Open:   http://$($webHost):$WebPort"
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    ForEach-Object { Write-Host "          http://$($_.IPAddress):$WebPort" }
Write-Host "  Sign in: admin@agency.com / Admin123!  (change it on the Users page)"
Write-Host "  Back up: $apiSettings"
Write-Host "  Database not created yet? Run $Target\database\full-database.sql in SSMS (F5)."

[CmdletBinding()]
param(
    [string]$Workspace,

    [ValidateSet("desktop-ui", "codex-cli")]
    [string]$DeliveryMode = "desktop-ui",

    [int]$ConsolePort = 18790,

    [string]$ConfigFile,

    [switch]$SkipLogin,

    [switch]$NoStart
)

# Usage:
#   npm run setup -- -Workspace "C:\work\my-codex-project" -DeliveryMode desktop-ui -ConsolePort 18790 -NoStart
#   npm run setup -- -Workspace "C:\work\my-codex-project" -ConfigFile "D:\bridge\.env" -NoStart
#   npm run setup -- -Workspace "C:\work\my-codex-project" -SkipLogin

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function Test-CommandExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandName
    )

    return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Assert-NodeVersion {
    if (-not (Test-CommandExists -CommandName "node")) {
        throw "Node.js >= 22 is required. Install Node.js, reopen PowerShell, and rerun setup."
    }

    $versionText = (& node --version).Trim()
    if ($versionText -notmatch "^v(?<major>\d+)\.") {
        throw "Could not read Node.js version from '$versionText'."
    }

    $major = [int]$Matches.major
    if ($major -lt 22) {
        throw "Node.js >= 22 is required. Current version is $versionText."
    }
}

function Assert-Npm {
    if (-not (Test-CommandExists -CommandName "npm")) {
        throw "npm is required. Install Node.js with npm, reopen PowerShell, and rerun setup."
    }
}

function Invoke-SetupStep {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [string[]]$Command
    )

    Write-Host ""
    Write-Host "==> $Label"
    & $Command[0] @($Command | Select-Object -Skip 1)
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

Set-Location -LiteralPath $ProjectRoot

Assert-NodeVersion
Assert-Npm

if ([string]::IsNullOrWhiteSpace($Workspace)) {
    $Workspace = $ProjectRoot
}
$ResolvedWorkspace = [System.IO.Path]::GetFullPath($Workspace)
if ([string]::IsNullOrWhiteSpace($ConfigFile)) {
    $ConfigFile = Join-Path $ProjectRoot ".env"
}
$ResolvedConfigFile = [System.IO.Path]::GetFullPath($ConfigFile)
$env:CODEX_WEIXIN_ENV_FILE = $ResolvedConfigFile

Invoke-SetupStep -Label "Install npm dependencies" -Command @("npm", "install")
Invoke-SetupStep -Label "Create or update .env" -Command @(
    "npm", "run", "init", "--",
    "--workspace", $ResolvedWorkspace,
    "--config-file", $ResolvedConfigFile,
    "--delivery-mode", $DeliveryMode,
    "--console-port", "$ConsolePort"
)
Invoke-SetupStep -Label "Run setup preflight" -Command @("npm", "run", "setup-check", "--", "-ConsolePort", "$ConsolePort")

if (-not $SkipLogin) {
    Invoke-SetupStep -Label "Log in Weixin bot" -Command @("npm", "run", "login")
}

if (-not $NoStart) {
    Invoke-SetupStep -Label "Start bridge" -Command @("npm", "start")
}

Write-Host ""
Write-Host "Setup finished."
Write-Host "Workspace: $ResolvedWorkspace"
Write-Host "Delivery mode: $DeliveryMode"
Write-Host "Console: http://127.0.0.1:$ConsolePort"

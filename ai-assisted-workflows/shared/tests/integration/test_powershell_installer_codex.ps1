# PowerShell Installer Test Suite - Codex
# Comprehensive testing for codex/install.ps1

param(
    [string]$TestScenario = "all",
    [switch]$Verbose,
    [string]$TestDir = "$env:TEMP\powershell-codex-installer-tests"
)

$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

$Colors = @{
    Green = [System.ConsoleColor]::Green
    Yellow = [System.ConsoleColor]::Yellow
    Red = [System.ConsoleColor]::Red
    Cyan = [System.ConsoleColor]::Cyan
}

function Write-ColorOutput { param([string]$Message,[System.ConsoleColor]$Color=[System.ConsoleColor]::White)
    $orig = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Output $Message
    $Host.UI.RawUI.ForegroundColor = $orig
}

function Start-Test { param([string]$Name)
    $script:TotalTests++
    Write-ColorOutput "`n=== Test: $Name ===" -Color $Colors.Cyan
}

function Complete-Test { param([string]$Name,[bool]$Passed,[string]$Message="")
    if ($Passed) { $script:PassedTests++; Write-ColorOutput "✓ PASS: $Name" -Color $Colors.Green }
    else { $script:FailedTests++; Write-ColorOutput "✗ FAIL: $Name" -Color $Colors.Red }
    if ($Message) { Write-Output "  $Message" }
}

function Ensure-TestDir { if (-not (Test-Path $TestDir)) { New-Item -ItemType Directory -Force -Path $TestDir | Out-Null } }

function Test-InstallerSyntax {
    Start-Test "Installer Syntax Validation"
    try {
        $installerPath = Join-Path $PSScriptRoot "..\..\..\systems\codex\install.ps1"
        $resolved = Resolve-Path $installerPath -ErrorAction Stop
        $errors=$null; $tokens=[System.Management.Automation.PSParser]::Tokenize((Get-Content $resolved -Raw),[ref]$errors)
        Complete-Test "Installer Syntax Validation" ($errors.Count -eq 0) "Tokens: $($tokens.Count)"
    } catch { Complete-Test "Installer Syntax Validation" $false $_.Exception.Message }
}

function Test-InstallerHelp {
    Start-Test "Installer Help Display"
    try {
        $installerPath = Join-Path $PSScriptRoot "..\..\..\systems\codex\install.ps1"
        $output = & $installerPath -? 2>&1
        Complete-Test "Installer Help Display" $true "Help executed"
    } catch { Complete-Test "Installer Help Display" $false $_.Exception.Message }
}

function Test-DryRun {
    Start-Test "Dry Run"
    try {
        Ensure-TestDir
        $installerPath = Join-Path $PSScriptRoot "..\..\..\systems\codex\install.ps1"
        $target = Join-Path $TestDir "dry-run"
        $out = & $installerPath $target -DryRun -SkipPython 2>&1
        $ok = ($LASTEXITCODE -eq 0)
        Complete-Test "Dry Run" $ok "Exit: $LASTEXITCODE"
    } catch { Complete-Test "Dry Run" $false $_.Exception.Message }
}

function Test-FreshInstall {
    Start-Test "Fresh Install"
    try {
        Ensure-TestDir
        $installerPath = Join-Path $PSScriptRoot "..\..\..\systems\codex\install.ps1"
        $target = Join-Path $TestDir "fresh"
        if (Test-Path $target) { Remove-Item -Recurse -Force -Path $target }
        & $installerPath $target -Mode Fresh -SkipPython 2>&1 | Out-Null
        $home = Join-Path $target '.codex'
        $ok = (Test-Path (Join-Path $home 'prompts')) -and (Test-Path (Join-Path $home 'rules')) -and (Test-Path (Join-Path $home 'config.toml'))
        Complete-Test "Fresh Install" $ok "Home: $home"
    } catch { Complete-Test "Fresh Install" $false $_.Exception.Message }
}

function Test-NoDuplicateTrust {
    Start-Test "No Duplicate Trust Entries"
    try {
        Ensure-TestDir
        $installerPath = Join-Path $PSScriptRoot "..\..\..\systems\codex\install.ps1"
        $target = Join-Path $TestDir "dupe-check"
        if (Test-Path $target) { Remove-Item -Recurse -Force -Path $target }
        & $installerPath $target -Mode Fresh -SkipPython 2>&1 | Out-Null
        & $installerPath $target -Mode Update -SkipPython 2>&1 | Out-Null
        $cfg = Join-Path $target '.codex\config.toml'
        $content = Get-Content -Raw -Path $cfg
        # Count occurrences of the absolute section
        $abs = Join-Path $target '.codex'
        $section = "[projects.`"$abs`"]"
        $count = ([regex]::Matches($content, [regex]::Escape($section))).Count
        Complete-Test "No Duplicate Trust Entries" ($count -le 1) "Count=$count"
    } catch {
        Complete-Test "No Duplicate Trust Entries" $false $_.Exception.Message
    }
}

function Summary {
    Write-ColorOutput "`nTotal: $script:TotalTests  Passed: $script:PassedTests  Failed: $script:FailedTests" -Color $Colors.Cyan
    if ($script:FailedTests -gt 0) { exit 1 }
}

Test-InstallerSyntax
Test-InstallerHelp
Test-DryRun
Test-FreshInstall
Test-NoDuplicateTrust
Summary

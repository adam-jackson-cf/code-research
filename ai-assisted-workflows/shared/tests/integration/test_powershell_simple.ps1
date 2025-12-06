# Simplified PowerShell Test to isolate syntax issue

param(
    [string]$TestScenario = "all",
    [string]$TestDir = "$env:TEMP\\powershell-installer-tests"
)

# Test configuration
$script:TestResults = @()
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

function Start-Test {
    param([string]$TestName)
    $script:TotalTests++
    Write-Output "=== Test: $TestName ==="
}

function Complete-Test {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )

    if ($Passed) {
        $script:PassedTests++
        Write-Output "✓ PASS: $TestName"
        if ($Message) { Write-Output "  $Message" }
    } else {
        $script:FailedTests++
        Write-Output "✗ FAIL: $TestName"
        if ($Message) { Write-Output "  $Message" }
    }
}

function Test-SimpleExample {
    Start-Test "Simple Example"

    try {
        $testValue = "Hello PowerShell"
        if ($testValue -eq "Hello PowerShell") {
            Complete-Test "Simple Example" $true "Basic string test passed"
        } else {
            Complete-Test "Simple Example" $false "Basic string test failed"
        }
    } catch {
        $errMsg = $_.Exception.Message
        Complete-Test "Simple Example" $false ("Test failed: {0}" -f $errMsg)
    }
}

function Show-TestSummary {
    Write-Output "`n=== Test Summary ==="
    Write-Output "Total Tests: $script:TotalTests"
    Write-Output "Passed: $script:PassedTests"
    Write-Output "Failed: $script:FailedTests"

    if ($script:FailedTests -gt 0) {
        exit 1
    } else {
        exit 0
    }
}

# Main execution
try {
    Write-Output "Simple PowerShell Test Suite"
    Write-Output "Test Directory: $TestDir"
    Write-Output "PowerShell Version: $($PSVersionTable.PSVersion)"
    Write-Output ""

    Test-SimpleExample
    Show-TestSummary

} catch {
    $errorMsg = $_.Exception.Message
    Write-Output "Test suite failed: {0}" -f $errorMsg
    exit 1
}

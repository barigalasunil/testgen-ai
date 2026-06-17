param(
    [string]$ProjectRoot = "D:\TCGen-Buddy"
)

$ErrorActionPreference = "Stop"

function ConvertTo-NewRunId {
    param([string]$OldName)
    if ($OldName -match '^([a-z]+)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$') {
        $suite = $matches[1]
        $yyyy = $matches[2]
        $mm = $matches[3]
        $dd = $matches[4]
        $hh = $matches[5]
        $min = $matches[6]
        $ss = $matches[7]
        $capitalizedSuite = $suite.Substring(0, 1).ToUpper() + $suite.Substring(1).ToLower()
        return "$dd$mm$yyyy$hh$min" + "_" + $capitalizedSuite
    }
    return $null
}

function Rename-Safe {
    param([string]$SourceDir, [string]$OldName, [string]$NewName)
    $oldPath = Join-Path $SourceDir $OldName
    $newPath = Join-Path $SourceDir $NewName
    if (-not (Test-Path $oldPath)) { return $false }
    if (Test-Path $newPath) {
        $counter = 1
        while (Test-Path (Join-Path $SourceDir "$NewName`_$counter")) { $counter++ }
        $newPath = Join-Path $SourceDir "$NewName`_$counter"
        Write-Host "  (Target exists, using: $NewName`_$counter)"
    }
    Rename-Item -Path $oldPath -NewName (Split-Path $newPath -Leaf)
    Write-Host "  Renamed '$OldName' -> '$(Split-Path $newPath -Leaf)'"
    return $true
}

$scanDirs = @(
    "public\automation-reports",
    "automation\reports\playwright-html",
    "automation\reports\allure-results",
    "automation\reports\allure-report",
    "automation\reports\healing",
    "automation\reports\logs",
    "automation\reports\screenshots",
    "automation\reports\traces"
)

Write-Host "=== Migrating Automation Report Folders ==="
Write-Host "Project root: $ProjectRoot"
Write-Host ""

$renameLog = @()

foreach ($relDir in $scanDirs) {
    $fullDir = Join-Path $ProjectRoot $relDir
    if (-not (Test-Path $fullDir)) {
        Write-Host "SKIP: $relDir (not found)"
        continue
    }
    Write-Host "Scanning: $relDir"
    $dirs = Get-ChildItem -LiteralPath $fullDir | Where-Object { $_.PSIsContainer }
    foreach ($item in $dirs) {
        $oldName = $item.Name
        $newName = ConvertTo-NewRunId -OldName $oldName
        if ($newName -and $oldName -ne $newName) {
            Write-Host "  Found old format: $oldName -> $newName"
            $renamed = Rename-Safe -SourceDir $fullDir -OldName $oldName -NewName $newName
            if ($renamed) {
                $renameLog += "$relDir/$oldName -> $newName"
            }
        }
    }
    Write-Host ""
}

Write-Host "=== Migration Complete ==="
if ($renameLog.Count -eq 0) {
    Write-Host "No folders needed renaming."
} else {
    Write-Host "Renamed $($renameLog.Count) folder(s):"
    $renameLog | ForEach-Object { Write-Host "  $_" }
}

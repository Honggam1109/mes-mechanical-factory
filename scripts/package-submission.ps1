# Builds submission/MES-submission.zip containing README.md and Source/.
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File scripts\package-submission.ps1
# Only the items listed below are copied, so new junk files never slip in.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "submission"
$stage = Join-Path $out "stage"
$source = Join-Path $stage "Source"
$zip = Join-Path $out "MES-submission.zip"

$folders = "src", "server", "tests", "scripts", "docs"
$files = "index.html", "package.json", "pnpm-lock.yaml", "tsconfig.json",
    "vite.config.ts", ".gitignore", ".gitattributes", ".mise.toml",
    ".env.example", ".figma\make\site.json"
# Unused images (one is a screenshot of another company's system).
$excluded = "src\assets\image.png", "src\assets\Background.jpeg", "src\assets\logo.png"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Force $source | Out-Null

foreach ($folder in $folders) {
    Copy-Item (Join-Path $root $folder) $source -Recurse
}
foreach ($file in $files) {
    $target = Join-Path $source $file
    New-Item -ItemType Directory -Force (Split-Path -Parent $target) | Out-Null
    Copy-Item (Join-Path $root $file) $target
}
$data = Join-Path $source "server\data"
if (Test-Path $data) { Remove-Item $data -Recurse -Force }
foreach ($file in $excluded) {
    $target = Join-Path $source $file
    if (Test-Path $target) { Remove-Item $target -Force }
}
Copy-Item (Join-Path $root "README.md") $stage

$bad = Get-ChildItem $stage -Recurse -Force | Where-Object {
    ($_.Name -match '^(node_modules|dist|build|\.venv|__pycache__|\.claude)$') -or
    ($_.Name -match '\.(sqlite|log|pyc)($|-)') -or
    ($_.Name -like ".env*" -and $_.Name -ne ".env.example") -or
    ($_.Name -like ".tmp*")
}
if ($bad) {
    $bad | ForEach-Object { Write-Host "Unexpected: $($_.FullName)" }
    throw "Packaging stopped: remove the items above first."
}

# Windows tar writes standard "/" paths (Compress-Archive in PowerShell 5.1 does not).
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip -C $stage README.md Source
if ($LASTEXITCODE -ne 0) { throw "tar failed" }
Remove-Item $stage -Recurse -Force

Write-Host ("Created {0} ({1:N1} MB)" -f $zip, ((Get-Item $zip).Length / 1MB))

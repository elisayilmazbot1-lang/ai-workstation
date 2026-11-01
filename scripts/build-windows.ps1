<#
.SYNOPSIS
    AI Workstation — Windows kurulum dosyası üretimi.

.DESCRIPTION
    Bu betik Windows üzerinde çalıştırılmalıdır. Gereksinimler:
      * Node.js 20.x (LTS) veya üzeri
      * npm 10.x
    Üretilen dosyalar:
      release\AI_WORKSTATION_Setup.exe     → kurulum sihirbazı (NSIS)
      release\AI_WORKSTATION_Portable.exe  → kurulum gerektirmeyen sürüm
      release\SHA256SUMS.txt               → SHA-256 özetleri

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\build-windows.ps1
#>
[CmdletBinding()]
param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Step($text) { Write-Host "`n▶ $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "✖ $text" -ForegroundColor Red; exit 1 }

Step 'Ortam denetimi'
$nodeVersion = (node --version) -replace 'v', ''
$major = [int]($nodeVersion.Split('.')[0])
if ($major -lt 20) { Fail "Node.js 20 veya üzeri gerekli (bulunan: $nodeVersion)." }
Write-Host "  Node.js $nodeVersion"

if (-not (Test-Path 'node_modules')) {
    Step 'Bağımlılıklar kuruluyor (npm ci)'
    npm ci
    if ($LASTEXITCODE -ne 0) { Fail 'npm ci başarısız.' }
} else {
    Write-Host '  node_modules mevcut, kurulum atlandı.'
}

if (-not $SkipTests) {
    Step 'Testler'
    npx vitest run
    if ($LASTEXITCODE -ne 0) { Fail 'Testler başarısız. Paket üretilmedi.' }
}

Step 'Monaco dosyaları'
node scripts/copy-monaco.mjs
if ($LASTEXITCODE -ne 0) { Fail 'Monaco kopyalanamadı.' }

Step 'Tür denetimi'
npx tsc -p tsconfig.json --noEmit
if ($LASTEXITCODE -ne 0) { Fail 'Tür denetimi başarısız.' }

Step 'Arayüz derlemesi'
npx vite build
if ($LASTEXITCODE -ne 0) { Fail 'Arayüz derlemesi başarısız.' }

Step 'Electron derlemesi'
npx electron-vite build
if ($LASTEXITCODE -ne 0) { Fail 'Electron derlemesi başarısız.' }

Step 'Kurulum dosyaları (NSIS + portable)'
npx electron-builder --win nsis portable --x64
if ($LASTEXITCODE -ne 0) { Fail 'electron-builder başarısız.' }

Step 'SHA-256 özetleri'
$lines = Get-ChildItem release -File |
    Where-Object { $_.Extension -in '.exe', '.zip', '.blockmap', '.yml' } |
    ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  release/$($_.Name)" }
$lines | Set-Content -Path (Join-Path $root 'SHA256SUMS.txt') -Encoding utf8
$lines | ForEach-Object { Write-Host "  $_" }

Write-Host "`n✔ Tamamlandı. Kurulum dosyaları: $root\release" -ForegroundColor Green
Write-Host '  Doğrulama: Get-AuthenticodeSignature release\AI_WORKSTATION_Setup.exe'

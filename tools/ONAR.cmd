@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AI Workstation - Ortam Onarimi

REM =====================================================================
REM  ORTAM ONARIMI  (Windows)
REM
REM  `npm ci` basarisiz olduysa once bunu calistirin.
REM  Su sorunlari tespit eder ve cozum soyler:
REM    - Node surumu uyumsuz (better-sqlite3 prebuild yok)
REM    - Visual Studio C++ derleyicisi yok (node-gyp hatasi)
REM    - Diskte yer yok
REM    - Kilitli node_modules (EBUSY/EPERM)
REM =====================================================================

set "PROJE=%~1"
if "%PROJE%"=="" set "PROJE=%~dp0..\AI_WORKSTATION"

echo.
echo ==========================================================
echo   AI WORKSTATION - ORTAM ONARIMI
echo ==========================================================
echo   Proje: %PROJE%
echo.

REM --- 1) Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo [1/5] Node.js ......... YOK
  echo.
  echo   ^>^> https://nodejs.org adresinden LTS surumu kurun.
  echo   ^>^> Kurulumdan sonra bu pencereyi KAPATIP yeniden acin.
  echo.
  pause
  exit /b 2
)
for /f "delims=" %%v in ('node --version') do set "NODEV=%%v"
for /f "tokens=1 delims=." %%m in ("!NODEV:v=!") do set "MAJOR=%%m"
echo [1/5] Node.js ......... !NODEV!

REM --- 2) Uyumluluk kontrolu ---
echo.
echo       better-sqlite3 12.11.1 su Node surumlerini destekler:
echo         20.x  22.x  23.x  24.x  25.x  26.x
echo.
if !MAJOR! GEQ 20 (
  if !MAJOR! LEQ 26 (
    echo       ^^> !NODEV! UYUMLU
    set "NODE_OK=1"
  ) else (
    echo       ^^> !NODEV! COK YENI - Windows on-derlenmis ikilisi olmayabilir
    set "NODE_OK=0"
  )
) else (
  echo       ^^> !NODEV! COK ESKI - en az v20 gerekli
  set "NODE_OK=0"
)

if "!NODE_OK!"=="0" (
  echo.
  echo ==========================================================
  echo   COZUM: Node surumunu degistirin
  echo ==========================================================
  echo.
  echo   DESTEKLENEN: v20 v22 v23 v24 v25 v26  ^(hepsi icin Windows
  echo                on-derlenmis ikili MEVCUT^)
  echo.
  echo   ONERILEN : Node 26 LTS  ^(28 Ekim 2026'dan beri aktif LTS^)
  echo   INDIR    : https://nodejs.org  ^(ana sayfadaki LTS dugmesi^)
  echo              Windows Installer ^(.msi^) - x64
  echo.
  echo   Kurduktan sonra:  node --version
  echo.
)

REM --- 3) Visual Studio C++ (yedek derleme icin) ---
echo.
set "VS_FOUND=0"
if exist "%ProgramFiles%\Microsoft Visual Studio\2022" set "VS_FOUND=1"
if exist "%ProgramFiles%\Microsoft Visual Studio\18" set "VS_FOUND=1"
if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\2022" set "VS_FOUND=1"
if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\18" set "VS_FOUND=1"
if "!VS_FOUND!"=="1" (
  echo [2/5] Visual Studio .... VAR ^(yedek derleme mumkun^)
) else (
  echo [2/5] Visual Studio .... YOK
  echo.
  echo       On-derlenmis ikili bulunamazsa node-gyp kaynaktan derlemeye
  echo       calisir ve Visual Studio ister. Uyumlu Node surumuyle bu
  echo       ADIM GEREKMEZ.
  echo.
  echo       Yine de kurmak isterseniz:
  echo         https://visualstudio.microsoft.com/visual-cpp-build-tools/
  echo         "Desktop development with C++" is yukunu secin.
  echo.
)

REM --- 4) Disk alani ---
echo.
for /f "tokens=3" %%a in ('dir /-c "%PROJE%" 2^>nul ^| find "bytes free"') do set "FREE=%%a"
if not defined FREE for /f "tokens=3" %%a in ('dir "%PROJE%" 2^>nul ^| find "bytes free"') do set "FREE=%%a"
if defined FREE (
  echo [3/5] Bos disk ......... !FREE! bayt
) else (
  echo [3/5] Bos disk ......... okunamadi
)
echo       Gerekli: ~1.5 GB ^(node_modules + electron^)

REM --- 5) Kilitli node_modules temizligi ---
echo.
if exist "%PROJE%\node_modules" (
  echo [4/5] node_modules ..... MEVCUT ^(temizleniyor^)
  echo.
  echo       Once calisan Node/Electron surecleri kapatiliyor...
  taskkill /F /IM electron.exe >nul 2>nul
  taskkill /F /IM "AI Workstation.exe" >nul 2>nul
  timeout /t 2 /nobreak >nul
  rmdir /s /q "%PROJE%\node_modules" 2>nul
  if exist "%PROJE%\node_modules" (
    echo       [!] Silinemedi. Bilgisayari yeniden baslatin veya
    echo           klasoru baska bir yerde acip tekrar deneyin.
    echo           ^(OneDrive/antivirus kilitleyebilir^)
  ) else (
    echo       [OK] node_modules silindi
  )
) else (
  echo [4/5] node_modules ..... YOK ^(temiz^)
)

REM --- 6) Proje dosyalari ---
echo.
if exist "%PROJE%\package.json" (
  echo [5/5] package.json .... VAR
) else (
  echo [5/5] package.json .... YOK
  echo.
  echo       ^>^> Yanlis klasor! 1-KAYNAK-KOD.zip dosyasini
  echo          %PROJE%  icine ayiklayin.
  pause
  exit /b 2
)

REM --- 7) better-sqlite3 surumu ---
echo.
if exist "%PROJE%\package.json" (
  findstr /C:"\"better-sqlite3\"" "%PROJE%\package.json" >nul 2>nul
  if errorlevel 1 (
    echo       [!] better-sqlite3 bagimliligi bulunamadi
  ) else (
    for /f "tokens=2 delims=:" %%a in ('findstr /C:"\"better-sqlite3\"" "%PROJE%\package.json"') do (
      echo       better-sqlite3: %%a
    )
  )
)

REM --- Ozet ---
echo.
echo ==========================================================
echo   SONRAKI ADIM
echo ==========================================================
echo.
if "!NODE_OK!"=="1" (
  echo   Ortam uygun. Su komutlari calistirin:
  echo.
  echo     cd "%PROJE%"
  echo   ^(PowerShell^) veya CMD icin: cd /d "%PROJE%"
  echo    echo     npm ci
  echo     npm run monaco
  echo     npm run verify
) else (
  echo   1^) Node.js surumunu degistirin ^(onerilen: v22 LTS^)
  echo   2^) Bu pencereyi kapatip ONAR.cmd yi yeniden calistirin
  echo   3^) Sonra: npm ci  -^>  npm run monaco  -^>  npm run verify
)
echo.
pause

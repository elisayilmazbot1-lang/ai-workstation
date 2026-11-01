@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AI Workstation - Teslim Dogrulama

REM =====================================================================
REM  TEK TIKLA DOGRULAMA  (Windows)
REM
REM  Kullanim: bu dosyaya CIFT TIKLAYIN.
REM  Klasor yapisi soyle olmali:
REM
REM    C:\Users\SERVER\Desktop\al\tarama\
REM    ├── TARA.cmd                  <- bu dosya
REM    ├── aw-scan.cjs
REM    └── manifest.json
REM
REM  ve taranacak klasor:
REM    C:\Users\SERVER\Desktop\al\AI_WORKSTATION\
REM
REM  Farkli bir yol icin:  TARA.cmd "D:\baska\yer\AI_WORKSTATION"
REM =====================================================================

set "HEDEF=%~1"
if "%HEDEF%"=="" set "HEDEF=%~dp0..\AI_WORKSTATION"

REM --- Varsayilan yolu sirayla dene ---
if not exist "%HEDEF%\package.json" (
  if exist "%USERPROFILE%\Desktop\al\AI_WORKSTATION\package.json" set "HEDEF=%USERPROFILE%\Desktop\al\AI_WORKSTATION"
)
if not exist "%HEDEF%\package.json" (
  if exist "%USERPROFILE%\Desktop\AI_WORKSTATION\package.json" set "HEDEF=%USERPROFILE%\Desktop\AI_WORKSTATION"
)
if not exist "%HEDEF%\package.json" (
  echo.
  echo [HATA] Urun klasoru otomatik bulunamadi.
  echo.
  echo   Kullanim:
  echo     TARA.cmd "C:\tam\yol\AI_WORKSTATION"
  echo.
  echo   Ornek:
  echo     TARA.cmd "C:\Users\SERVER\Desktop\al\AI_WORKSTATION"
  echo.
  echo   Denenen yollar:
  echo     %~dp0..\AI_WORKSTATION
  echo     %USERPROFILE%\Desktop\al\AI_WORKSTATION
  echo     %USERPROFILE%\Desktop\AI_WORKSTATION
  echo.
  pause
  exit /b 2
)

echo.
echo ==========================================================
echo   AI WORKSTATION - TESLIM DOGRULAMA
echo ==========================================================
echo   Taranacak klasor : %HEDEF%
echo   Arac            : %~dp0aw-scan.cjs
echo ==========================================================
echo.

REM --- 1) Node.js kurulu mu? ---
where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  echo.
  echo   Cozum: https://nodejs.org adresinden LTS surumu kurun.
  echo   Kurulumdan sonra bu pencereyi KAPATIP tekrar cift tiklayin.
  echo.
  pause
  exit /b 2
)
for /f "delims=" %%v in ('node --version') do set "NODEV=%%v"
echo   Node.js         : !NODEV!

REM --- 2) Node surumu 18+ mi? ---
for /f "tokens=1 delims=." %%m in ("!NODEV:v=!") do set "MAJOR=%%m"
if !MAJOR! LSS 18 (
  echo.
  echo [HATA] Node.js surumu cok eski: !NODEV!
  echo        En az v18 gerekli. https://nodejs.org
  echo.
  pause
  exit /b 2
)

REM --- 3) Arac dosyalari yerinde mi? ---
if not exist "%~dp0aw-scan.cjs" (
  echo [HATA] aw-scan.cjs bulunamadi.
  echo        Bu .cmd dosyasi ile AYNI klasorde olmali.
  pause
  exit /b 2
)
if not exist "%~dp0manifest.json" (
  echo [HATA] manifest.json bulunamadi.
  echo        Bu .cmd dosyasi ile AYNI klasorde olmali.
  pause
  exit /b 2
)

REM --- 4) Hedef klasor var mi? ---
if not exist "%HEDEF%" (
  echo [HATA] Klasor bulunamadi:
  echo        %HEDEF%
  echo.
  echo   Kontrol edin: 1-KAYNAK-KOD.zip dosyasini actiginiz yer dogru mu?
  echo   Farkli yol icin: TARA.cmd "D:\baska\yer\AI_WORKSTATION"
  pause
  exit /b 2
)

if not exist "%HEDEF%\package.json" (
  echo [UYARI] Bu klasorde package.json yok.
  echo         Yanlis klasoru gosteriyor olabilirsiniz.
  echo.
)

REM --- 5) Tarama ---
echo.
echo ----------------------------------------------------------
echo   1/2  BUTUNLUK TARAMASI  (217 dosya, SHA-256)
echo ----------------------------------------------------------
echo.
node "%~dp0aw-scan.cjs" "%HEDEF%"
set "SONUC1=%errorlevel%"

echo.
echo ----------------------------------------------------------
echo   2/2  KAYNAK KOD DENETIMI  (13 kontrol)
echo ----------------------------------------------------------
echo.
node "%~dp0aw-scan.cjs" "%HEDEF%" --mode code
set "SONUC2=%errorlevel%"

REM --- 6) Ozet ---
echo.
echo ==========================================================
echo   OZET
echo ==========================================================
if %SONUC1%==0 (
  echo   Butunluk       : TAM  ^(217/217 dosya referansla ayni^)
) else (
  echo   Butunluk       : EKSIK/BOZUK  -^> yukaridaki listeye bakin
)
if %SONUC2%==0 (
  echo   Kod denetimi   : TUM KONTROLLER GECTI
) else (
  echo   Kod denetimi   : Bazi kontroller basarisiz ^(bilinen eksikler^)
)
echo.

REM --- 7) JSON rapor yaz ---
set "RAPOR=%~dp0tarama-sonucu.json"
node "%~dp0aw-scan.cjs" "%HEDEF%" --mode all --json "%RAPOR%" >nul 2>nul
if exist "%RAPOR%" echo   JSON rapor     : %RAPOR%

echo.
echo   Sonraki adim:
echo     cd /d "%HEDEF%"
echo     npm ci
echo     npm run monaco
echo     npm run verify
echo.
pause
exit /b %SONUC1%

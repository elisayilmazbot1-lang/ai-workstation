@echo off
chcp 65001 >nul
title AI Workstation - Kurulum ve Dogrulama
cd /d "%~dp0"

echo ==========================================================
echo   AI WORKSTATION - KURULUM VE DOGRULAMA
echo   Klasor: %CD%
echo ==========================================================
echo.

REM --- On kontrol: package.json ---
if not exist "package.json" (
  echo [HATA] package.json bulunamadi.
  echo        Bu dosyayi AI_WORKSTATION klasorune koyun.
  echo        Simdiki klasor: %CD%
  echo.
  pause
  exit /b 2
)

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi. https://nodejs.org adresinden kurun.
  pause
  exit /b 2
)
for /f "delims=" %%v in ('node --version') do echo Node surumu : %%v
echo.

REM --- 1) node_modules temizligi ---
if exist "node_modules" (
  echo [1/4] Eski node_modules temizleniyor...
  taskkill /F /IM electron.exe >nul 2>nul
  taskkill /F /IM "AI Workstation.exe" >nul 2>nul
  timeout /t 2 /nobreak >nul
  rmdir /s /q "node_modules" 2>nul
  if exist "node_modules" (
    echo       [!] Silinemedi - bilgisayari yeniden baslatin.
    pause
    exit /b 2
  )
) else (
  echo [1/4] node_modules yok, temiz.
)
echo.

REM --- 2) npm ci ---
echo [2/4] npm ci calisiyor... ^(2-5 dakika, sabir^)
echo.
call npm ci
if errorlevel 1 (
  echo.
  echo ==========================================================
  echo   [HATA] npm ci BASARISIZ
  echo ==========================================================
  echo.
  echo   Cozum icin: ONAR.cmd yi calistirin veya
  echo              SORUN_GIDERME.md dosyasina bakin.
  echo.
  pause
  exit /b 1
)
echo.
echo [2/4] npm ci TAMAM
echo.

REM --- 3) monaco ---
echo [3/4] npm run monaco...
call npm run monaco
if errorlevel 1 (
  echo [HATA] monaco basarisiz.
  pause
  exit /b 1
)
echo.

REM --- 4) verify ---
echo [4/4] npm run verify... ^(1-2 dakika^)
echo.
call npm run verify
if errorlevel 1 (
  echo.
  echo [HATA] Dogrulama basarisiz. Yukaridaki ciktiya bakin.
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo   TAMAM - Kurulum ve dogrulama basarili
echo ==========================================================
echo.
echo   Uygulamayi baslatmak icin:  npm run dev
echo.
pause

@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AI Workstation - Kurulum ve Dogrulama

REM =====================================================================
REM  KULLANIM
REM    KUR.cmd                          -> ..\AI_WORKSTATION klasorunu kullanir
REM    KUR.cmd "C:\yol\AI_WORKSTATION"  -> belirtilen klasoru kullanir
REM
REM  ONEMLI: Bu betik TEK BASINA yeterlidir.
REM    - 1-KAYNAK-KOD.zip icindeki hicbir betige ihtiyac duymaz.
REM    - GitHub'dan ikili indirmez (ag engeli sorun degil).
REM    - Windows'un kendi tar.exe programini kullanir.
REM
REM  NEDEN --ignore-scripts ?
REM    GitHub Releases erisimi engelliyse `npm ci` icindeki prebuild-install
REM    hazir ikiliyi indiremez -> node-gyp -> Visual Studio ister -> coker.
REM    Bu betik derlemeyi atlar, hazir Windows ikilisini yerlestirir.
REM =====================================================================

set "HEDEF=%~1"
if "%HEDEF%"=="" set "HEDEF=%~dp0.."
set "HEDEF=%HEDEF:"=%"
set "ARAC=%~dp0"
if "%ARAC:~-1%"=="\" set "ARAC=%ARAC:~0,-1%"

echo ==========================================================
echo   AI WORKSTATION - KURULUM VE DOGRULAMA
echo ==========================================================
echo   Urun klasoru : %HEDEF%
echo   Arac klasoru : %ARAC%
echo.

if not exist "%HEDEF%\package.json" (
  echo [HATA] %HEDEF%\package.json bulunamadi.
  echo.
  echo   1-KAYNAK-KOD.zip dosyasini ayri bir klasore acin ve
  echo   o klasoru gosterin:
  echo.
  echo     KUR.cmd "C:\Users\SERVER\Desktop\al\AI_WORKSTATION"
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
for /f "delims=" %%v in ('node --version') do set "NODEV=%%v"
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set "MAJOR=%%v"
echo   Node surumu  : %NODEV%

REM --- Node surumu -> ABI ---
set "ABI="
if "%MAJOR%"=="20" set "ABI=115"
if "%MAJOR%"=="22" set "ABI=127"
if "%MAJOR%"=="23" set "ABI=131"
if "%MAJOR%"=="24" set "ABI=137"
if "%MAJOR%"=="25" set "ABI=141"
if "%MAJOR%"=="26" set "ABI=147"
if "%ABI%"=="" (
  echo.
  echo [HATA] Node %MAJOR% desteklenmiyor. Desteklenen: 20 22 23 24 25 26
  echo        Node 26 LTS onerilir: https://nodejs.org
  pause
  exit /b 2
)
set "ARSIV=%ARAC%\prebuilds\better-sqlite3-v12.11.1-node-v%ABI%-win32-x64.tar.gz"
echo   Node ABI     : %ABI%
echo   Ikili arsivi : %ARSIV%
if not exist "%ARSIV%" (
  echo.
  echo [HATA] Ikili arsivi bulunamadi.
  echo        %ARSIV%
  echo.
  echo   prebuilds\ klasoru 5-TARAMA-ARACI.zip icinde gelir.
  echo   ZIP'i ayni klasore actiginizdan emin olun.
  pause
  exit /b 2
)
echo.

cd /d "%HEDEF%" || (echo [HATA] Klasore girilemedi. & pause & exit /b 2)

REM --- 1) node_modules temizligi ---
if exist "node_modules" (
  echo [1/7] Eski node_modules temizleniyor...
  taskkill /F /IM electron.exe >nul 2>nul
  taskkill /F /IM "AI Workstation.exe" >nul 2>nul
  timeout /t 2 /nobreak >nul
  rmdir /s /q "node_modules" 2>nul
  if exist "node_modules" (
    echo       [UYARI] Silinemedi.
    echo       Cozum: Bilgisayari yeniden baslatin veya
    echo              antivirus/OneDrive klasoru serbest biraksin.
    pause
    exit /b 2
  )
) else (
  echo [1/7] node_modules yok, temiz.
)
echo.

REM --- 2) npm ci (derleme betikleri ATLANIR) ---
echo [2/7] npm ci --ignore-scripts ... ^(1-3 dakika^)
echo.
call npm ci --ignore-scripts
if errorlevel 1 (
  echo.
  echo [HATA] npm ci BASARISIZ. ONAR.cmd veya SORUN_GIDERME.md
  pause
  exit /b 1
)
echo.
echo [2/7] npm ci TAMAM
echo.

REM --- 3) Windows yerel modulu (tar ile) ---
echo [3/7] better-sqlite3 Windows ikilisi yerlestiriliyor...
if not exist "node_modules\better-sqlite3" (
  echo.
  echo [HATA] node_modules\better-sqlite3 yok. npm ci tamamlanmamis.
  pause
  exit /b 1
)
tar xzf "%ARSIV%" -C "node_modules\better-sqlite3"
if errorlevel 1 (
  echo.
  echo [HATA] tar basarisiz. Windows 10 gerekli ^(tar.exe dahil^).
  pause
  exit /b 1
)
if not exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo.
  echo [HATA] better_sqlite3.node olusmadi.
  pause
  exit /b 1
)
for %%F in ("node_modules\better-sqlite3\build\Release\better_sqlite3.node") do set "BOYUT=%%~zF"
echo       Dosya boyutu : %BOYUT% bayt
echo [3/7] TAMAM
echo.

REM --- 4) Modul gercekten yukleniyor mu? ---
echo [4/7] better-sqlite3 yukleme testi...
node -e "const D=require('better-sqlite3');const d=new D(':memory:');d.exec('CREATE TABLE t(a)');d.prepare('INSERT INTO t VALUES(?)').run('ok');const r=d.prepare('SELECT a FROM t').get();d.close();console.log('       veritabani calisiyor: '+r.a);process.exit(r.a=='ok'?0:1)"
if errorlevel 1 (
  echo.
  echo ==========================================================
  echo   [HATA] better-sqlite3 YUKLENEMEDI
  echo ==========================================================
  echo.
  echo   Iki olasilik:
  echo   1^) Arsiv bozuk  - 5-TARAMA-ARACI.zip'i yeniden indirin
  echo   2^) Node surumu ile ABI uyusmuyor
  echo.
  echo   Kontrol:
  echo     node --version
  echo     dir node_modules\better-sqlite3\build\Release
  echo.
  pause
  exit /b 1
)
echo [4/7] TAMAM
echo.

REM --- 5) monaco ---
echo [5/7] npm run monaco ...
call npm run monaco
if errorlevel 1 (
  echo [HATA] monaco basarisiz.
  pause
  exit /b 1
)
echo.

REM --- 6) Electron calisma zamani ---
echo [6/7] Electron calisma zamani kontrolu...
if exist "node_modules\electron\dist\version" (
  echo       Electron zaten kurulu, atlandi.
) else (
  echo       --ignore-scripts Electron ikilisini indirmedi.
  echo       Simdi indiriliyor ^(ayna sunucu denenir^)...
  echo.
  set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
  cd /d "node_modules\electron"
  call node install.js
  cd /d "%HEDEF%"
  if not exist "node_modules\electron\dist\version" (
    echo.
    echo       [UYARI] Ayna basarisiz. Ikinci yol deneniyor...
    set "ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/v"
    cd /d "node_modules\electron"
    call node install.js
    cd /d "%HEDEF%"
  )
  if exist "node_modules\electron\dist\version" (
    echo [6/7] Electron TAMAM
  ) else (
    echo.
    echo       [UYARI] Electron indirilemedi. Uygulama ^(npm run dev^) acilmaz.
    echo           Dogrulama ^(npm run verify^) yine de calisir.
    echo.
    echo           Elle cozum:
    echo             cd node_modules\electron
    echo             set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    echo             node install.js
    echo.
  )
)
echo.

REM --- 7) verify ---
echo [7/7] npm run verify ... ^(1-2 dakika^)
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
echo   Uygulamayi baslatmak icin:
echo     cd "%HEDEF%"
echo     npm run dev
echo.
pause
endlocal

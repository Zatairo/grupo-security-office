@echo off
setlocal EnableExtensions

REM Iniciador local seguro para Grupo Security (Windows).
REM Calcula la raiz desde la ubicacion del archivo para funcionar con doble clic.
set "REPO_ROOT=%~dp0"
set "BACKEND_DIR=%REPO_ROOT%src\backend"
set "FRONTEND_DIR=%REPO_ROOT%src\frontend"

REM Validar Node.js y npm.
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado o no esta disponible en PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm no esta disponible en PATH.
    pause
    exit /b 1
)

REM Validar estructura y dependencias ya instaladas.
if not exist "%BACKEND_DIR%\package.json" (
    echo ERROR: No se encuentra "%BACKEND_DIR%\package.json".
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo ERROR: No se encuentra "%FRONTEND_DIR%\package.json".
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\node_modules\" (
    echo ERROR: Faltan dependencias del backend.
    echo Ejecuta manualmente: cd /d "%BACKEND_DIR%" ^&^& npm install
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules\" (
    echo ERROR: Faltan dependencias del frontend.
    echo Ejecuta manualmente: cd /d "%FRONTEND_DIR%" ^&^& npm install
    pause
    exit /b 1
)

REM Detectar procesos existentes sin detenerlos.
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if errorlevel 1 (
    echo Iniciando backend en puerto 3000...
    start "Grupo Security - Backend" /D "%BACKEND_DIR%" cmd /k "npm run dev"
) else (
    echo El puerto 3000 ya esta en uso. No se inicia otro backend.
)

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if errorlevel 1 (
    echo Iniciando frontend en puerto 5173...
    start "Grupo Security - Frontend" /D "%FRONTEND_DIR%" cmd /k "npm run dev"
) else (
    echo El puerto 5173 ya esta en uso. No se inicia otro frontend.
)

REM Esperar un maximo de 45 segundos a que el backend responda HTTP 200.
echo Esperando el backend...
set "BACKEND_READY=0"

for /L %%I in (1,1,45) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "BACKEND_READY=1"
        goto :backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if "%BACKEND_READY%"=="0" (
    echo ERROR: El backend no respondio HTTP 200 en 45 segundos.
    echo Revisa la ventana "Grupo Security - Backend".
    echo No se abrira el navegador.
    pause
    exit /b 1
)

REM Esperar un maximo de 20 segundos a que Vite responda.
echo Backend listo. Esperando el frontend...
set "FRONTEND_READY=0"

for /L %%I in (1,1,20) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "FRONTEND_READY=1"
        goto :frontend_ready
    )
    timeout /t 1 /nobreak >nul
)

:frontend_ready
if "%FRONTEND_READY%"=="0" (
    echo ERROR: El frontend no respondio HTTP 200 en 20 segundos.
    echo Revisa la ventana "Grupo Security - Frontend".
    echo No se abrira el navegador.
    pause
    exit /b 1
)

REM Abrir el navegador una vez que los dos servicios esten disponibles.
start "" "http://localhost:5173/"

echo.
echo ==========================================
echo Entorno local iniciado.
echo Frontend: http://localhost:5173/
echo Health API: http://localhost:3000/api/health
echo Mantén abiertas las ventanas de backend y frontend.
echo ==========================================
pause
exit /b 0
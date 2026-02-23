@echo off
REM Frontend Docker Setup Script for Windows
REM This script helps you start the frontend using Docker Compose

setlocal enabledelayedexpansion

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] docker-compose is not installed. Please install it and try again.
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo [WARNING] .env file not found. Creating one with default values...
    (
        echo # API Configuration
        echo VITE_API_URL=http://host.docker.internal:8000
    ) > .env
    echo [SUCCESS] .env file created with default API URL
)

REM Parse command line arguments
if "%1"=="" goto :dev
if "%1"=="dev" goto :dev
if "%1"=="development" goto :dev
if "%1"=="prod" goto :prod
if "%1"=="production" goto :prod
if "%1"=="vite" goto :vite
if "%1"=="build" goto :build
if "%1"=="down" goto :down
if "%1"=="logs" goto :logs
if "%1"=="clean" goto :clean
if "%1"=="help" goto :help
if "%1"=="-h" goto :help
if "%1"=="--help" goto :help
goto :unknown

:dev
echo [INFO] Starting development server with hot reload...
docker-compose --profile dev up --build
goto :end

:prod
echo [INFO] Starting production server with Nginx...
docker-compose --profile prod up --build
goto :end

:vite
echo [INFO] Starting Vite development server (fastest option)...
docker-compose --profile vite up --build
goto :end

:build
echo [INFO] Building production image...
docker-compose --profile prod build
echo [SUCCESS] Production image built successfully
goto :end

:down
echo [INFO] Stopping all services...
docker-compose down
echo [SUCCESS] All services stopped
goto :end

:logs
echo [INFO] Showing logs from running containers...
docker-compose logs -f
goto :end

:clean
echo [WARNING] This will remove all containers, images, and volumes. Are you sure? (y/N)
set /p response=
if /i "%response%"=="y" (
    echo [INFO] Cleaning up Docker resources...
    docker-compose down --volumes --remove-orphans
    docker system prune -f
    echo [SUCCESS] Cleanup completed
) else (
    echo [INFO] Cleanup cancelled
)
goto :end

:help
echo Usage: %0 [OPTION]
echo.
echo Options:
echo   dev, development    Start development server with hot reload (default)
echo   prod, production    Start production server with Nginx
echo   vite                Start Vite development server (fastest)
echo   build               Build production image only
echo   down                Stop and remove all containers
echo   logs                Show logs from running containers
echo   clean               Clean up containers, images, and volumes
echo   help, -h, --help    Show this help message
echo.
echo Examples:
echo   %0                  # Start development server
echo   %0 dev              # Start development server
echo   %0 prod             # Start production server
echo   %0 vite             # Start Vite server
echo   %0 build            # Build production image
echo   %0 down             # Stop all services
echo   %0 logs             # Show logs
echo   %0 clean            # Clean up everything
goto :end

:unknown
echo [ERROR] Unknown option: %1
echo.
goto :help

:end

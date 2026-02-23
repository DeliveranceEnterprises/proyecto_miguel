# Docker Setup for Frontend

This project includes Docker configurations for both development and production environments.

## Quick Start

### Using Setup Scripts (Recommended)

**Linux/macOS:**
```bash
# Make script executable (first time only)
chmod +x setup.sh

# Start development server (default)
./setup.sh

# Other options
./setup.sh vite      # Fastest development server
./setup.sh prod      # Production mode
./setup.sh build     # Build production image only
./setup.sh down      # Stop all services
./setup.sh logs      # Show logs
./setup.sh clean     # Clean up everything
./setup.sh help      # Show all options
```

**Windows:**
```cmd
# Start development server (default)
setup.bat

# Other options
setup.bat vite       # Fastest development server
setup.bat prod       # Production mode
setup.bat build      # Build production image only
setup.bat down       # Stop all services
setup.bat logs       # Show logs
setup.bat clean      # Clean up everything
setup.bat help       # Show all options
```

### Manual Docker Commands

### Development Mode (with hot reload)
```bash
# Using Vite directly in container
docker-compose --profile vite up

# Or using development Dockerfile
docker-compose --profile dev up
```

### Production Mode
```bash
docker-compose --profile prod up
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# For local development with Docker
VITE_API_URL=http://host.docker.internal:8000

# For production/remote API
# VITE_API_URL=https://deliverance-api.kindfield-4439a458.westeurope.azurecontainerapps.io
```

## Available Services

### 1. Frontend Development (`frontend-dev`)
- **Port**: 5174
- **Profile**: `dev`
- **Features**: Hot reload, volume mounting
- **Command**: `docker-compose --profile dev up`

### 2. Frontend Production (`frontend-prod`)
- **Port**: 80
- **Profile**: `prod`
- **Features**: Nginx server, optimized build
- **Command**: `docker-compose --profile prod up`

### 3. Frontend Vite (`frontend-vite`)
- **Port**: 5174
- **Profile**: `vite`
- **Features**: Direct Vite server, fastest development
- **Command**: `docker-compose --profile vite up`

## Usage Examples

### Development with Backend
```bash
# Start frontend in development mode
docker-compose --profile vite up

# Access at http://localhost:5174
```

### Production Build
```bash
# Build and run production version
docker-compose --profile prod up --build

# Access at http://localhost:80
```

### Custom API URL
```bash
# Override API URL
VITE_API_URL=http://your-api-server:8000 docker-compose --profile vite up
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 5174
lsof -i :5174

# Kill the process or use different port
docker-compose --profile vite up --scale frontend-vite=1 -p 5175:5174
```

### API Connection Issues
- Make sure your backend is running
- Use `host.docker.internal` for local backend
- Check firewall settings

### Volume Mount Issues
- Ensure Docker has access to the project directory
- On Windows, check Docker Desktop file sharing settings

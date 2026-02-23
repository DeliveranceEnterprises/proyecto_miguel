#!/bin/bash

# Frontend Docker Setup Script
# This script helps you start the frontend using Docker Compose

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  dev, development    Start development server with hot reload (default)"
    echo "  prod, production    Start production server with Nginx"
    echo "  vite                Start Vite development server (fastest)"
    echo "  build               Build production image only"
    echo "  down                Stop and remove all containers"
    echo "  logs                Show logs from running containers"
    echo "  clean               Clean up containers, images, and volumes"
    echo "  help, -h, --help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  # Start development server"
    echo "  $0 dev              # Start development server"
    echo "  $0 prod             # Start production server"
    echo "  $0 vite             # Start Vite server"
    echo "  $0 build            # Build production image"
    echo "  $0 down             # Stop all services"
    echo "  $0 logs             # Show logs"
    echo "  $0 clean            # Clean up everything"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check if docker compose is available
check_docker_compose() {
    if ! command -v docker compose > /dev/null 2>&1; then
        print_error "docker compose is not installed. Please install it and try again."
        exit 1
    fi
}

# Function to create .env file if it doesn't exist
create_env_file() {
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating one with default values..."
        cat > .env << EOF
# API Configuration
VITE_API_URL=http://host.docker.internal:8000
EOF
        print_success ".env file created with default API URL"
    fi
}

# Function to start development server
start_development() {
    print_status "Starting development server with hot reload..."
    docker compose --profile dev up --build
}

# Function to start production server
start_production() {
    print_status "Starting production server with Nginx..."
    docker compose --profile prod up --build
}

# Function to start Vite server
start_vite() {
    print_status "Starting Vite development server (fastest option)..."
    docker compose --profile vite up --build
}

# Function to build production image
build_production() {
    print_status "Building production image..."
    docker compose --profile prod build
    print_success "Production image built successfully"
}

# Function to stop services
stop_services() {
    print_status "Stopping all services..."
    docker compose down
    print_success "All services stopped"
}

# Function to show logs
show_logs() {
    print_status "Showing logs from running containers..."
    docker compose logs -f
}

# Function to clean up
clean_up() {
    print_warning "This will remove all containers, images, and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up Docker resources..."
        docker compose down --volumes --remove-orphans
        docker system prune -f
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Main script logic
main() {
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Create .env file if needed
    create_env_file
    
    # Parse command line arguments
    case "${1:-dev}" in
        "dev"|"development")
            start_development
            ;;
        "prod"|"production")
            start_production
            ;;
        "vite")
            start_vite
            ;;
        "build")
            build_production
            ;;
        "down")
            stop_services
            ;;
        "logs")
            show_logs
            ;;
        "clean")
            clean_up
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown option: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"

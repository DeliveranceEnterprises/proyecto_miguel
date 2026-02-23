
# FastAPI Project - Frontend

The frontend is built with [Vite](https://vitejs.dev/), [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/), [TanStack Query](https://tanstack.com/query), [TanStack Router](https://tanstack.com/router) and [Chakra UI](https://chakra-ui.com/).

## Frontend development

### Option 1: Docker (Recommended)

The easiest way to run the frontend is using Docker:

#### Quick Start with Setup Scripts

**Linux/macOS:**
```bash
# Make script executable (first time only)
chmod +x setup.sh

# Development mode with hot reload (default)
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
# Development mode with hot reload (default)
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

#### Manual Docker Commands

```bash
# Development mode with hot reload
docker-compose --profile vite up

# Production mode
docker-compose --profile prod up
```

See [DOCKER.md](./DOCKER.md) for detailed Docker setup instructions.

### Option 2: Local Development

Before you begin, ensure that you have either the Node Version Manager (nvm) or Fast Node Manager (fnm) installed on your system.

* To install fnm follow the [official fnm guide](https://github.com/Schniz/fnm#installation). If you prefer nvm, you can install it using the [official nvm guide](https://github.com/nvm-sh/nvm#installing-and-updating).

* Install the necessary NPM packages:

```bash
npm install
```

* Create a `.env` file with your API configuration:

```bash
# For local development
VITE_API_URL=http://127.0.0.1:8000

# For remote API
# VITE_API_URL=https://your-api-domain.com
```

* Start the live server with the following `npm` script:

```bash
npm run dev
```

* Then open your browser at http://localhost:5174/.

Notice that this live server is not running inside Docker, it's for local development, and that is the recommended workflow. Once you are happy with your frontend, you can build the frontend Docker image and start it, to test it in a production-like environment. But building the image at every change will not be as productive as running the local development server with live reload.

Check the file `package.json` to see other available options.

### Project Structure

The frontend code is structured as follows:

* `src/` - The main frontend source code
* `src/components/` - React components organized by feature
  * `Admin/` - Admin-related components
  * `Common/` - Shared components (Navbar, Sidebar, etc.)
  * `UserSettings/` - User settings components
* `src/routes/` - Application routes and pages
  * `_layout/` - Layout routes (admin, index, settings)
  * `login.tsx`, `signup.tsx` - Authentication pages
* `src/client/` - Generated OpenAPI client
* `src/hooks/` - Custom React hooks
* `src/contexts/` - React contexts
* `public/` - Static assets
* `theme.tsx` - Chakra UI custom theme

## Generate API Client

The frontend uses an auto-generated API client based on the backend's OpenAPI specification.

### Generate Client

* Download the OpenAPI JSON file from your backend API:

```bash
# If backend is running locally
curl http://127.0.0.1:8000/api/v1/openapi.json -o openapi.json

# If using remote API
curl https://your-api-domain.com/api/v1/openapi.json -o openapi.json
```

* To simplify the names in the generated frontend client code, modify the `openapi.json` file:

```bash
node modify-openapi-operationids.js
```

* Generate the frontend client:

```bash
npm run generate-client
```

* Commit the changes.

**Note:** Run these steps whenever the backend API changes to keep the frontend client in sync.

## Using a Remote API

If you want to use a remote API, you can set the environment variable `VITE_API_URL` to the URL of the remote API. Create a `.env` file in the project root:

```env
# For remote API
VITE_API_URL=https://api.my-domain.example.com

# For local development
# VITE_API_URL=http://127.0.0.1:8000
```

Then, when you run the frontend, it will use that URL as the base URL for the API.

## Available Scripts

* `npm run dev` - Start development server
* `npm run build` - Build for production
* `npm run preview` - Preview production build
* `npm run lint` - Run linter
* `npm run generate-client` - Generate API client from OpenAPI spec

## End-to-End Testing with Playwright

The frontend includes end-to-end tests using Playwright. To run the tests:

### Using Docker (Recommended)

```bash
# Start the backend
docker-compose --profile prod up -d

# Run tests
npx playwright test

# Run tests in UI mode
npx playwright test --ui

# Clean up
docker-compose down -v
```

### Using Setup Scripts

```bash
# Start backend and run tests
./setup.sh prod &
npx playwright test
./setup.sh down
```

### Test Structure

* `tests/` - Test files
* `playwright.config.ts` - Playwright configuration
* `tests/auth.setup.ts` - Authentication setup
* `tests/login.spec.ts` - Login tests
* `tests/sign-up.spec.ts` - Signup tests
* `tests/user-settings.spec.ts` - User settings tests

For more information, see the [Playwright documentation](https://playwright.dev/docs/intro).

## Docker Setup

This project includes comprehensive Docker support for both development and production:

* **Development**: Hot reload with Vite
* **Production**: Optimized Nginx build
* **Setup Scripts**: Easy management with `setup.sh` (Linux/macOS) or `setup.bat` (Windows)

See [DOCKER.md](./DOCKER.md) for detailed Docker instructions.

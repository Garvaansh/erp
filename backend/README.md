# ERP Backend

This is the backend component of the ERP system, built with Go using the Fiber web framework. It provides RESTful APIs for authentication, inventory management, production tracking, and dashboard analytics.

## Prerequisites

Before setting up the backend, ensure you have the following installed on your system:

- **Go**: Version 1.26.1 or later. Download from [golang.org](https://golang.org/dl/).
- **PostgreSQL**: Version 12 or later. Ensure the server is running and you have database access.
- **Git**: For cloning the repository.
- **Air** (optional, for hot reloading during development): Install with `go install github.com/cosmtrek/air@latest`.
- **sqlc**: For generating Go code from SQL queries. Install with `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`.

## Project Structure

```
backend/
├── cmd/
│   └── api/
│       └── main.go          # Application entry point
├── db/
│   ├── migrations/          # Database migration files
│   └── queries/             # SQL query files for sqlc
├── internal/
│   ├── auth/                # Authentication logic
│   ├── db/                  # Generated database code (sqlc)
│   ├── handlers/            # HTTP request handlers
│   ├── middleware/          # Custom middleware
│   ├── models/              # Data models
│   └── services/            # Business logic services
├── .air.toml                # Air configuration for hot reloading
├── .env.example             # Environment variables template
├── go.mod                   # Go module file
├── go.sum                   # Go dependencies checksum
└── sqlc.yaml                # sqlc configuration
```

## Setup Instructions

1. **Install Dependencies**:

   ```bash
   go mod download
   ```

2. **Environment Configuration**:
   - Copy the example environment file:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and set the required variables:
     - `DATABASE_URL`: PostgreSQL connection string (e.g., `postgres://user:password@localhost:5432/erp_db?sslmode=disable`)
     - `FRONTEND_URL`: URL of the frontend application (e.g., `http://localhost:3000`)
     - `JWT_SECRET`: A secure random string for JWT token signing

3. **Database Setup**:
   - Ensure PostgreSQL is running and create a database for the application.
   - Run database migrations:

     ```bash
     # Install golang-migrate if not already installed
     go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

     # Run migrations
     migrate -path db/migrations -database "$DATABASE_URL" up
     ```

   - (Optional) Seed the database with initial data:
     ```bash
     go run cmd/seed/main.go
     ```

4. **Generate Database Code**:
   ```bash
   sqlc generate
   ```

## Running the Application

### Seed the database with developer auth credentials

```bash
go  run cmd/seed/main.go
```

### Development Mode (with Hot Reloading)

```bash
air
```

This will start the server with automatic reloading on code changes.

### Production Mode

```bash
go build -o bin/api cmd/api/main.go
./bin/api
```

The server will start on the port specified in the environment or default to 8080.

## API Documentation

The backend provides RESTful APIs. Key endpoints include:

- **Authentication**: `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`
- **Dashboard**: `/api/v1/dashboard`
- **Inventory**: `/api/v1/inventory/*`
- **Items**: `/api/v1/items/*`
- **Production**: `/api/v1/production/*`

Refer to the handler files in `internal/handlers/` for detailed endpoint information.

## Testing

Run tests with:

```bash
go test ./...
```

## Additional Notes

- The application uses JWT for authentication. Ensure the `JWT_SECRET` is kept secure.
- Database migrations are handled via the `migrate` tool. Always backup your database before running migrations in production.
- For development, use the `.env` file to override default configurations.
- The application includes middleware for CORS, rate limiting, and security headers.</content>
  <parameter name="filePath">d:\projects\erp\backend\README.md

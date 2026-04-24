# Garvaansh/erp

Comprehensive backend system for an Enterprise Resource Planning (ERP) application.

## About

This project provides a robust backend for ERP functionality, focusing on inventory and production management. It's built with Go, SQLC, and PostgreSQL to ensure type-safe database operations and efficient business process handling.

## Features

- Inventory management
- Production orders handling
- Procurement processes
- Type-safe database interactions with SQLC
- RESTful API server
- Database schema migrations
- Initial data seeding

## Tech Stack

- Go
- SQLC
- PostgreSQL

## Getting Started

### Prerequisites

- Go installed (version 1.18 or higher)
- PostgreSQL installed and running

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/Garvaansh/erp.git
   cd erp
   ```
2. Install dependencies:
   ```sh
   go mod tidy
   ```
3. Set up environment variables by copying `.env.example` to `.env` and configuring as needed.

### Running the Project

1. Run database migrations:
   ```sh
   go run cmd/migrate/main.go
   ```
2. Seed the database with initial data:
   ```sh
   go run cmd/seed/main.go
   ```
3. Start the API server:
   ```sh
   go run cmd/api/main.go
   ```

## Project Structure

- `.`: Root directory with configuration files and metadata.
- `backend/`: Contains server-side logic and database interactions.
  - `.env.example`: Template for environment variables.
  - `cmd/`: Holds Go applications (`api`, `migrate`, `seed`).
  - `db/migrations/`: SQL scripts for database schema changes.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

MIT
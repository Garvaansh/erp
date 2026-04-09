# ERP Frontend

This is the frontend component of the ERP system, built with Next.js, React, and TypeScript. It provides a modern web interface for managing inventory, production, finance, and user authentication.

## Prerequisites

Before setting up the frontend, ensure you have the following installed on your system:

- **Node.js**: Version 18 or later. Download from [nodejs.org](https://nodejs.org/).
- **Yarn**: Package manager. Install with `npm install -g yarn` or use your preferred method.
- **Git**: For cloning the repository.

## Project Structure

```
frontend/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── (auth)/          # Authentication routes
│   │   ├── (dashboard)/     # Dashboard routes
│   │   ├── api/             # API routes (BFF pattern)
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   ├── components/          # Reusable UI components
│   │   ├── layouts/         # Layout components
│   │   └── ui/              # shadcn/ui components
│   └── features/            # Feature-based modules
│       ├── auth/            # Authentication feature
│       ├── dashboard/       # Dashboard feature
│       ├── finance/         # Finance feature
│       ├── inventory/       # Inventory feature
│       ├── logs/            # Logs feature
│       └── hr/              # HR feature
├── public/                  # Static assets
├── .env.example             # Environment variables template
├── next.config.ts           # Next.js configuration
├── package.json             # Dependencies and scripts
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── proxy.ts                 # API proxy configuration
```

## Setup Instructions

1. **Install Dependencies**:
   Since this is a yarn workspace, install dependencies from the root:

   ```bash
   yarn install
   ```

2. **Environment Configuration**:
   - Copy the example environment file:
     ```bash
     cp frontend/.env.example frontend/.env.local
     ```
   - Edit `frontend/.env.local` and set the required variables:
     - `NEXT_BACKEND_API_URL`: URL of the backend API (e.g., `http://localhost:8080/api/v1`)
     - `NEXT_PUBLIC_API_URL`: Public API URL for client-side requests (e.g., `/api`)

## Running the Application

### Development Mode

```bash
yarn workspace frontend dev
```

This will start the development server on `http://localhost:3000`.

### Production Build

```bash
yarn workspace frontend build
yarn workspace frontend start
```

## Key Features

- **Authentication**: Secure login/logout with session management
- **Dashboard**: Overview of key metrics and recent activity
- **Inventory Management**: Track items, batches, and stock levels
- **Production Tracking**: Monitor production orders and journals
- **Finance Overview**: Financial summaries and reports
- **Logs**: Daily logging functionality

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Hook Form for forms
- **API Communication**: Custom API client with fetch
- **Validation**: Zod for schema validation
- **Icons**: Lucide React

## Development Guidelines

- Use the feature-based architecture: each feature in `src/features/` contains actions, API calls, components, schemas, and types.
- API routes in `src/app/api/` follow the Backend-for-Frontend (BFF) pattern.
- UI components are built with shadcn/ui and styled with Tailwind CSS.
- Follow TypeScript strict mode for type safety.

## Building and Deployment

1. Build the application:

   ```bash
   yarn workspace frontend build
   ```

2. Start the production server:
   ```bash
   yarn workspace frontend start
   ```

For deployment, ensure environment variables are set correctly and the backend API is accessible.

## Additional Notes

- The frontend communicates with the backend via API routes that proxy requests.
- Session management is handled via HTTP-only cookies.
- The application includes responsive design for mobile and desktop.
- Error handling and loading states are implemented throughout.</content>
  <parameter name="filePath">d:\projects\erp\frontend\README.md

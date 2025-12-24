# Bridge.dev Frontend

React + TypeScript frontend for Bridge.dev, a no-code integration platform.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query) + React Context
- **Form Handling**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ and npm
- Backend running on `http://localhost:8000` (see `../backend/README.md`)

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Environment Variables

Create `.env.local` with the following:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_NAME=Bridge.dev
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:5173
```

### Build

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── assets/          # Static assets (images, fonts)
├── components/      # Reusable UI components
│   ├── ui/          # shadcn/ui components
│   ├── layout/      # Layout components (Navbar, Sidebar, Footer)
│   └── common/      # Common components (LoadingSpinner, ErrorBoundary)
├── pages/           # Page components (one per route)
│   ├── auth/        # Authentication pages
│   ├── dashboard/   # Dashboard page
│   ├── workflows/   # Workflow-related pages
│   └── settings/    # Settings pages
├── hooks/           # Custom React hooks
├── lib/             # Library code and utilities
│   ├── api/         # API client and service functions
│   ├── utils/       # Utility functions
│   └── constants/   # Application constants
├── types/           # TypeScript type definitions
├── contexts/        # React contexts
├── router/          # React Router configuration
├── styles/          # Global styles
├── App.tsx          # Root app component
└── main.tsx         # Application entry point
```

## Key Features

### Authentication

- JWT-based authentication with token refresh
- Persistent login state via localStorage
- Protected routes with automatic redirects
- Auth context for global auth state

### API Integration

- Axios client with request/response interceptors
- Automatic token injection
- Error handling and transformation
- Type-safe API services

### Routing

- React Router v6 with lazy loading
- Protected routes for authenticated pages
- Route constants for type-safe navigation

### Styling

- Tailwind CSS for utility-first styling
- shadcn/ui component library
- Dark mode support
- Responsive design

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Use path aliases (`@/components`, `@/lib`, etc.)
- Prefer functional components and hooks

### State Management

- Use React Query for server state
- Use React Context for global client state (auth, theme, etc.)
- Use local state (useState) for component-specific state

### API Calls

- Always use the API client from `@/lib/api`
- Define types for all API responses in `@/types`
- Use React Query hooks for data fetching

### Components

- Keep components small and focused
- Use shadcn/ui components when available
- Extract reusable logic into custom hooks
- Use the `cn` utility for conditional classes

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting
- `npm run type-check` - Run TypeScript compiler

## Next Steps

This is the foundational setup (Task 28). Next tasks will implement:

- **Task 29**: Authentication pages (Login, Register)
- **Task 30**: Core layout components (Navbar, Sidebar, Footer)
- **Task 31**: API client and type definitions (expanded)
- **Task 32+**: Full application pages and features

## Contributing

See the main repository README for contribution guidelines.

# Frontend Deployment

## Overview

The Hermit dashboard is a React application built with Vite and TailwindCSS. It's served statically by the Go backend in production.

## High-Level Flow

```
Development
    │
    ▼
┌─────────────────────┐
│  npm run dev       │ ◄── Vite dev server (hot reload)
│  (dashboard)       │
└─────────────────────┘

Production Build
    │
    ▼
┌─────────────────────┐
│  npm run build     │ ◄── Creates dist/ folder
│  (dashboard)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Go serves dist/   │ ◄── Fiber static file serving
│  (server.go)      │
└─────────────────────┘
```

## Build Process

### 1. Frontend Build Command
**File: `dashboard/package.json`**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

### 2. Vite Configuration
**File: `dashboard/vite.config.ts`**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
```

### 3. Production Build
**Command:**
```bash
cd dashboard && npm run build
```

Output:
```
dist/
├── index.html
└── assets/
    ├── index-C7RAUV7r.js    # Bundled JS
    └── index-DloBXHaV.css    # Bundled CSS
```

## Backend Static Serving

**File: `internal/api/server.go`**
```go
func (s *Server) setupStaticRoutes(app *fiber.App) {
    distPath := "./dashboard/dist"

    // Serve uploaded images
    app.Static("/data/image", "./data/image")

    // Serve dashboard static files
    app.Static("/", distPath)

    // SPA fallback - serve index.html for unknown routes
    app.Use(func(c *fiber.Ctx) error {
        path := c.Path()
        // Don't intercept API or app routes
        if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/apps") {
            return c.Next()
        }
        return c.SendFile(distPath + "/index.html")
    })
}
```

## Makefile Targets

**File: `Makefile`**
```makefile
# Build only frontend
build-ui:
    cd dashboard && npm run build

# Build everything (UI + Server + Docker)
build: build-ui build-server build-docker

# Development
dev:
    go run ./cmd/hermit/main.go

# Production
run: build
    ./hermit
```

## Cheatsheet

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (hot reload) |
| `npm run build` | Production build to dist/ |
| `npm run preview` | Preview production build locally |
| `make build-ui` | Build frontend only |
| `make build` | Build frontend + backend |
| `make run` | Build and run production |

## Frontend Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: TailwindCSS 3
- **Icons**: Lucide React
- **HTTP**: Native fetch API
- **State**: React hooks (useState, useEffect)

## Directory Structure

```
dashboard/
├── src/
│   ├── components/     # React components
│   │   ├── AgentsTab.tsx
│   │   ├── CalendarTab.tsx
│   │   ├── DocsTab.tsx
│   │   ├── SettingsTab.tsx
│   │   └── modals/     # Modal components
│   ├── types.ts        # TypeScript interfaces
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── dist/               # Build output (committed)
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Environment Variables

The frontend uses an empty `API_BASE` (same-origin):
```typescript
const API_BASE = '';  // Uses window.location.origin
```

## Related Files

- Package.json: `dashboard/package.json`
- Vite Config: `dashboard/vite.config.ts`
- Tailwind Config: `dashboard/tailwind.config.js`
- Static Routes: `internal/api/server.go` (lines 393-406)
- Makefile: `Makefile`

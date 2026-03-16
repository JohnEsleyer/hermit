# Frontend-Backend Communication

## Overview

The React frontend communicates with the Go backend via RESTful HTTP APIs using the native `fetch` API. Authentication uses HTTP-only cookies.

## High-Level Flow

```
React Frontend                    Go Backend
     │                                │
     │ ── GET /api/auth/check ──────► │
     │ ◄── {authenticated: false} ─── │
     │                                │
     │ ── POST /api/auth/login ─────► │
     │ ◄── {success: true} + cookie ─ │
     │                                │
     │ ── GET /api/agents ───────────► │
     │ ◄── [{...}, {...}] ─────────── │
     │                                │
     │ ── POST /api/agents ──────────► │
     │ ◄── {id: 1, success: true} ─── │
```

## Code Flow

### 1. API Base Configuration
**File: `dashboard/src/App.tsx`**
```typescript
const API_BASE = '';  // Empty = same origin (localhost:3000)
```

### 2. Auth Check on Load
**File: `dashboard/src/App.tsx`**
```typescript
useEffect(() => {
  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/check`);
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        fetchAgents();
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };
  checkAuth();
}, []);
```

### 3. Login Request
**File: `dashboard/src/App.tsx`**
```typescript
const handleLogin = async (username: string, password: string) => {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success) {
    setIsAuthenticated(true);
    fetchAgents();
  }
};
```

### 4. Logout Request
**File: `dashboard/src/App.tsx`**
```typescript
const handleLogout = async () => {
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
  setIsAuthenticated(false);
  setShowLogin(true);
};
```

### 5. Fetch Agents
**File: `dashboard/src/App.tsx`**
```typescript
const fetchAgents = async () => {
  const res = await fetch(`${API_BASE}/api/agents`);
  const data = await res.json();
  setAgents(data || []);
};
```

### 6. Create Calendar Event
**File: `dashboard/src/components/CalendarTab.tsx`**
```typescript
const handleCreate = async () => {
  await fetch(`${API_BASE}/api/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEvent),
  });
  fetchEvents();
};
```

### 7. Delete Calendar Event
**File: `dashboard/src/components/CalendarTab.tsx`**
```typescript
const handleDelete = async (id: number) => {
  await fetch(`${API_BASE}/api/calendar/${id}`, { method: 'DELETE' });
  fetchEvents();
};
```

## Authentication Flow

### Frontend (React)
```typescript
// Login sets HTTP-only cookie automatically
// Cookie sent with all subsequent requests automatically
// Logout clears the cookie
```

### Backend (Go Fiber)
```go
// CheckAuth extracts session from cookie
func (s *Server) HandleCheckAuth(c *fiber.Ctx) error {
    session := c.Cookies("session")
    if session == "" {
        return c.JSON(fiber.Map{"authenticated": false})
    }
    
    id, _ := strconv.ParseInt(session, 10, 64)
    username, _, _ := s.db.GetUserByID(id)
    
    if username == "" {
        return c.JSON(fiber.Map{"authenticated": false})
    }
    return c.JSON(fiber.Map{"authenticated": true, "username": username})
}

// Login sets the cookie
func (s *Server) HandleLogin(c *fiber.Ctx) error {
    // ... verify credentials ...
    c.Cookie(&fiber.Cookie{
        Name:     "session",
        Value:    fmt.Sprintf("%d", id),
        Path:     "/",
        HTTPOnly: true,  // JavaScript cannot access
    })
    return c.JSON(fiber.Map{"success": true})
}
```

## Common API Patterns

### GET Request
```typescript
const data = await fetch(`${API_BASE}/api/endpoint`).then(r => r.json());
```

### POST Request (JSON)
```typescript
await fetch(`${API_BASE}/api/endpoint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

### DELETE Request
```typescript
await fetch(`${API_BASE}/api/endpoint/${id}`, { method: 'DELETE' });
```

## Cheatsheet

| Operation | Frontend File | Function |
|-----------|---------------|----------|
| Auth Check | `App.tsx:100` | `checkAuth` |
| Login | `App.tsx:127` | `handleLogin` |
| Logout | `App.tsx:116` | `handleLogout` |
| Fetch Agents | `App.tsx:88` | `fetchAgents` |
| Calendar CRUD | `CalendarTab.tsx` | Various |
| Settings | `SettingsTab.tsx` | Various |

## Error Handling

```typescript
try {
  const res = await fetch(`${API_BASE}/api/endpoint`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Request failed');
  }
  const data = await res.json();
  // Handle data
} catch (err) {
  console.error('Request failed:', err);
  // Show error to user
}
```

## Related Files

- Frontend App: `dashboard/src/App.tsx`
- Calendar Tab: `dashboard/src/components/CalendarTab.tsx`
- Settings Tab: `dashboard/src/components/SettingsTab.tsx`
- API Handlers: `internal/api/server.go`
- Auth Handlers: `internal/api/server.go` (lines 408-460)

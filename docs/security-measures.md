# Security Measures

> See also: [Authentication](./authentication.md)

## Overview

Hermit implements multiple layers of security to protect the system, data, and users.

## Security Layers

```
┌─────────────────────────────────────────────┐
│ 1. Network Layer                            │
│    • HTTP-only cookies                      │
│    • No JWT (stateful sessions)            │
├─────────────────────────────────────────────┤
│ 2. Authentication                           │
│    • Username/password login                │
│    • Password hashing (SHA256)              │
│    • Session-based auth                     │
├─────────────────────────────────────────────┤
│ 3. Agent Authorization                      │
│    • Telegram user allowlist                │
│    • Per-agent access control               │
├─────────────────────────────────────────────┤
│ 4. Container Isolation                       │
│    • Docker containers per agent            │
│    • No container escape                    │
├─────────────────────────────────────────────┤
│ 5. Input Validation                         │
│    • Request body parsing                   │
│    • Parameter sanitization                │
└─────────────────────────────────────────────┘
```

## Code Implementation

### 1. HTTP-Only Cookies
**File: `internal/api/server.go`**
```go
c.Cookie(&fiber.Cookie{
    Name:     "session",
    Value:    fmt.Sprintf("%d", id),
    Path:     "/",
    HTTPOnly: true,  // Cannot be accessed by JavaScript
    Secure:   true,  // Only sent over HTTPS
    SameSite: "lax",
})
```

### 2. Password Hashing
**File: `internal/db/db.go`**
```go
func hashPassword(password string) string {
    // SHA256 hash (consider using bcrypt in production)
    hash := sha256.Sum256([]byte(password))
    return hex.EncodeToString(hash[:])
}
```

### 3. Telegram User Allowlist
**File: `internal/api/server.go`**

Authorization is checked in `ProcessTelegramUpdate` for each incoming message:

```go
func (s *Server) ProcessTelegramUpdate(agent *db.Agent, update telegram.Update) {
    // Check authorization
    allowed := false
    if agent.AllowedUsers == "" {
        allowed = true  // No restrictions
    } else {
        // Check user ID and username
        allowedUsers := strings.Split(agent.AllowedUsers, ",")
        for _, u := range allowedUsers {
            if strings.TrimSpace(u) == userID || 
               strings.TrimSpace(u) == update.Message.From.Username {
                allowed = true
                break
            }
        }
    }

    if !allowed {
        // Send unauthorized message and return
        return
    }
    // Process message...
}
```

### 4. Container Isolation
**File: `internal/docker/cubicle.go`**
```go
func (c *Client) Run(name, image string, detach bool) error {
    // Each agent gets its own container
    // No shared resources between agents
    resp, err := c.cli.ContainerCreate(ctx, &container.Config{
        Image: image,
        Cmd:   []string{"sleep", "infinity"},
    }, nil, nil, nil, name)  // name = agent-specific
    
    return c.cli.ContainerStart(ctx, resp.ID, types.ContainerStartOptions{})
}
```

### 5. Request Validation
**File: `internal/api/server.go`**
```go
func (s *Server) HandleCreateAgent(c *fiber.Ctx) error {
    var req struct{ Name, Role, Personality string }
    
    // Parse and validate
    if err := c.BodyParser(&req); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
    }
    
    // Required fields check
    if req.Name == "" {
        return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
    }
    
    // ...
}
```

### 6. Takeover Mode Protection
**File: `internal/api/server.go`**
```go
// Takeover mode requires explicit activation via /takeover command
// It allows direct XML commands but:
func (s *Server) handleTakeoverInput(...) {
    // 1. User must be authorized (in allowlist)
    // 2. Must know the /takeover command
    // 3. Limited to terminal commands and messages
    feedback := s.ExecuteXMLPayload(agentId, chatID, xmlInput, bot)
}
```

## Cheatsheet

| Security Measure | Location | Implementation |
|-----------------|----------|----------------|
| HTTP-only cookie | `server.go:419` | `HTTPOnly: true` |
| Password hash | `db.go:345` | SHA256 |
| Auth check | `server.go:434` | Session cookie |
| Agent allowlist | `server.go:1789` | User ID/username check |
| Container isolation | `cubicle.go:306` | Per-agent containers |
| Input validation | `server.go:865` | BodyParser + checks |

## Database Security

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,  -- SHA256
    role TEXT NOT NULL DEFAULT 'admin',
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Agents have allowed_users field
CREATE TABLE agents (
    -- ...
    allowed_users TEXT NOT NULL DEFAULT '',  -- Comma-separated Telegram IDs
    -- ...
);
```

## Known Limitations

1. **Password Hashing**: Uses SHA256 without salt - consider bcrypt/argon2 for production
2. **No Rate Limiting**: API endpoints lack rate limiting
3. **No HTTPS**: Default development mode uses HTTP (should use reverse proxy in production)
4. **No CSRF Protection**: Cookie-based auth (Fiber has CSRF middleware available)

## Recommendations for Production

1. **Use reverse proxy** (nginx, Caddy) with HTTPS
2. **Implement rate limiting** using Fiber middleware
3. **Use bcrypt** instead of SHA256 for passwords
4. **Add CSRF protection** using Fiber's csrf middleware
5. **Enable Secure cookie flag** in production

## Related Files

- Auth Implementation: `internal/api/server.go` (lines 408-460)
- Database Auth: `internal/db/db.go` (lines 289-368)
- Allowlist: `internal/api/server.go` (lines 1789-1822)
- Container Management: `internal/docker/cubicle.go`

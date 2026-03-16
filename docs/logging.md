# Logging System

## Overview

Hermit has two logging systems:
1. **Audit Logs** - Stored in SQLite for dashboard viewing
2. **Application Logs** - stdout/stderr for server diagnostics

## High-Level Flow

```
Action Occurs
    │
    ▼
┌─────────────────────┐
│  s.db.LogAction    │
│  (db.go)          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  INSERT audit_logs │
│  (SQLite)         │
└─────────────────────┘
          │
          ▼ (concurrently)
┌─────────────────────┐
│  LogAction         │ ──► Viewable in Dashboard Logs Tab
│  (API)             │
└─────────────────────┘
```

## Code Flow

### 1. Log Action (Database)
**File: `internal/db/db.go`**
```go
type AuditLog struct {
    ID        int64
    AgentID   int64
    UserID    string
    Action    string      // Category: system, agent, docker, network
    Details   string      // Detailed message
    CreatedAt string
}

func (d *DB) LogAction(agentID int64, userID, action, details string) error {
    _, err := d.db.Exec(`
        INSERT INTO audit_logs (agent_id, user_id, action, details)
        VALUES (?, ?, ?, ?)
    `, agentID, userID, action, details)
    return err
}
```

### 2. Get Audit Logs
**File: `internal/db/db.go`**
```go
func (d *DB) GetAuditLogs(agentID int64, limit int) ([]*AuditLog, error) {
    rows, err := d.db.Query(`
        SELECT id, agent_id, user_id, action, details, created_at
        FROM audit_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?
    `, agentID, limit)
    defer rows.Close()

    var logs []*AuditLog
    for rows.Next() {
        l := &AuditLog{}
        rows.Scan(&l.ID, &l.AgentID, &l.UserID, &l.Action, &l.Details, &l.CreatedAt)
        logs = append(logs, l)
    }
    return logs, nil
}

func (d *DB) GetAllAuditLogs(category string, limit int) ([]*AuditLog, error) {
    query := `SELECT id, agent_id, user_id, action, details, created_at FROM audit_logs`
    
    if category != "" && category != "all" {
        query += " WHERE action LIKE ?"
    }
    query += " ORDER BY created_at DESC LIMIT ?"
    
    // Execute query...
}
```

### 3. API Handler
**File: `internal/api/server.go`**
```go
func (s *Server) HandleGetLogs(c *fiber.Ctx) error {
    category := c.Query("category", "all")
    limit, _ := strconv.Atoi(c.Query("limit", "100"))

    logs, err := s.db.GetAllAuditLogs(category, limit)
    
    // Map agent info to logs
    for _, log := range logs {
        if agent, ok := agentMap[log.AgentID]; ok {
            log.AgentName = agent.Name
            log.AgentPic = agent.ProfilePic
        }
    }

    return c.JSON(logs)
}
```

### 4. Usage in Code
**File: `internal/api/server.go`**
```go
// Log agent creation
s.db.LogAction(id, "system", "agent_created", fmt.Sprintf("Agent '%s' created", a.Name))

// Log Docker container
s.db.LogAction(existing.ID, "docker", "container_created", "Container created and started")

// Log LLM request
s.db.LogAction(agent.ID, "network", "llm_request", 
    fmt.Sprintf("Provider: %s, Model: %s", agent.Provider, agent.Model))

// Log Telegram message
s.db.LogAction(agentId, "agent", "telegram_received", 
    fmt.Sprintf("From: %s, Message: %s", userID, userText))

// Log terminal execution
s.db.LogAction(agentID, "system", "terminal_execute", fmt.Sprintf("Command: %s", cmd))
```

## Cheatsheet

| Operation | File | Function |
|-----------|------|----------|
| Log Action | `db.go:370` | `LogAction` |
| Get Agent Logs | `db.go:378` | `GetAuditLogs` |
| Get All Logs | `db.go:399` | `GetAllAuditLogs` |
| Logs API | `server.go:550` | `HandleGetLogs` |

## Log Categories

| Category | Prefix | Examples |
|----------|--------|----------|
| System | `system.*` | agent_created, terminal_execute, message_sent |
| Agent | `agent.*` | telegram_received, ai_processing, llm_response |
| Docker | `docker.*` | container_created, container_stopped, container_reset |
| Network | `network.*` | llm_request, tunnel_started |
| LLM | `llm_*` | llm_request, llm_response, llm_error |

## Database Schema

```sql
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(agent_id) REFERENCES agents(id)
);
```

## Viewing Logs

- **Dashboard**: Logs tab → filter by category (all/system/agent/docker/network)
- **API**: `GET /api/logs?category=all&limit=100`

## Related Files

- Database Functions: `internal/db/db.go` (lines 370-429)
- API Handler: `internal/api/server.go` (lines 550-613)
- Frontend Logs Tab: `dashboard/src/components/LogsTab.tsx`

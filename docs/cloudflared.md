# Cloudflared CLI Integration

## Overview

HermitShell uses `cloudflared` (Cloudflare Tunnel) to create public URLs for the dashboard and agent web apps. This is **optional** - Telegram communication works via long polling without any tunnel.

## High-Level Flow

```
Server Start
    │
    ▼
┌─────────────────────┐
│ Check cloudflared │
│ binary exists     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ StartQuickTunnel   │
│ (tunnel.go)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Execute cloudflared│
│ tunnel --url      │
└─────────┬───────────┘
          │
          ▼ (parse stderr for URL)
┌─────────────────────┐
│ Extract public URL │
│ *.trycloudflare.com│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Store URL          │
│ (TunnelManager)   │
└─────────────────────┘
```

## Code Flow

### 1. Tunnel Manager
**File: `internal/cloudflare/tunnel.go`**
```go
type TunnelManager struct {
    mu        sync.Mutex
    processes map[string]*exec.Cmd
    cancels   map[string]context.CancelFunc
    urls      map[string]string
}

func NewTunnelManager() *TunnelManager {
    return &TunnelManager{
        processes: make(map[string]*exec.Cmd),
        cancels:   make(map[string]context.CancelFunc),
        urls:      make(map[string]string),
    }
}
```

### 2. Start Quick Tunnel
**File: `internal/cloudflare/tunnel.go`**
```go
func (m *TunnelManager) StartQuickTunnel(id string, port int) (string, error) {
    m.mu.Lock()
    if _, exists := m.processes[id]; exists {
        url := m.urls[id]
        m.mu.Unlock()
        return url, nil  // Already running
    }

    ctx, cancel := context.WithCancel(context.Background())
    m.cancels[id] = cancel
    m.mu.Unlock()

    urlChan := make(chan string, 1)
    go m.runTunnelLoop(ctx, id, port, urlChan)

    // Wait for URL with timeout
    select {
    case url := <-urlChan:
        m.mu.Lock()
        m.urls[id] = url
        m.mu.Unlock()
        return url, nil
    case <-time.After(60 * time.Second):
        cancel()
        return "", fmt.Errorf("timeout waiting for tunnel URL")
    }
}
```

### 3. Tunnel Loop (Process Management)
**File: `internal/cloudflare/tunnel.go`**
```go
func (m *TunnelManager) runTunnelLoop(ctx context.Context, id string, port int, urlChan chan string) {
    firstRun := true
    urlRe := regexp.MustCompile(`https?://[a-zA-Z0-9-]+\.trycloudflare\.com`)

    for {
        select {
        case <-ctx.Done():
            return
        default:
        }

        // Execute cloudflared command
        cmd := exec.CommandContext(ctx, "cloudflared", "tunnel", "--url", 
            fmt.Sprintf("http://localhost:%d", port))

        stderr, _ := cmd.StderrPipe()
        cmd.Start()

        // Parse stderr for URL
        reader := bufio.NewReader(stderr)
        for {
            line, _ := reader.ReadString('\n')
            if match := urlRe.FindString(line); match != "" {
                if firstRun {
                    urlChan <- match  // Send URL to channel
                    firstRun = false
                }
                m.urls[id] = match  // Update stored URL
            }
        }

        // Wait for process to exit, then restart
        cmd.Wait()
        time.Sleep(5 * time.Second)  // Backoff before restart
    }
}
```

### 4. Health Check
**File: `internal/cloudflare/tunnel.go`**
```go
func (m *TunnelManager) CheckTunnelHealth(id string, timeout time.Duration) bool {
    url := m.GetURL(id)
    if url == "" {
        return false
    }

    client := &http.Client{Timeout: timeout}
    resp, err := client.Get(url)
    if err != nil {
        return false
    }
    defer resp.Body.Close()

    return resp.StatusCode >= 200 && resp.StatusCode < 500
}
```

### 5. Stop Tunnel
**File: `internal/cloudflare/tunnel.go`**
```go
func (m *TunnelManager) StopTunnel(id string) {
    m.mu.Lock()
    defer m.mu.Unlock()

    // Cancel context (stops tunnel loop)
    if cancel, exists := m.cancels[id]; exists {
        cancel()
        delete(m.cancels, id)
    }

    // Kill process
    if cmd, exists := m.processes[id]; exists {
        if cmd.Process != nil {
            cmd.Process.Kill()
        }
        delete(m.processes, id)
    }
    delete(m.urls, id)
}
```

## Cheatsheet

| Operation | File | Function |
|-----------|------|----------|
| New Manager | `tunnel.go:31` | `NewTunnelManager` |
| Start Tunnel | `tunnel.go:43` | `StartQuickTunnel` |
| Tunnel Loop | `tunnel.go:73` | `runTunnelLoop` |
| Stop Tunnel | `tunnel.go:161` | `StopTunnel` |
| Get URL | `tunnel.go:178` | `GetURL` |
| Health Check | `tunnel.go:191` | `CheckTunnelHealth` |
| Check Binary | `tunnel.go:16` | `CheckBinary` |

## Tunnel Usage in Server

**File: `internal/api/server.go`**
```go
func (s *Server) HandleGetSettings(c *fiber.Ctx) error {
    // Get or create tunnel for dashboard
    tunnelURL := s.tunnels.GetURL("dashboard")
    isHealthy := s.tunnels.CheckTunnelHealth("dashboard", 2*time.Second)

    // Start tunnel if not running
    if tunnelURL == "" {
        go s.tunnels.StartQuickTunnel("dashboard", port)
    }
}
```

## Installation

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

## Domain Mode

If you have a public domain and want to use it instead of Cloudflare Quick Tunnels:

1. Go to **Settings** in the dashboard.
2. Enable **Domain Mode**.
3. Enter your **Domain Name** (e.g., `hermit.example.com`).
4. Set up an A record or CNAME pointing to your server's IP.
5. Configure a reverse proxy like Nginx or Traefik (see [Installation Guide](./installation.md)).

When Domain Mode is enabled, the system will:
- Stop automatic tunnel creation.
- Use your domain for Telegram webhooks.
- Assume you are handling SSL via your reverse proxy.

## Key Points

1. **Quick Tunnels**: Uses `cloudflared tunnel --url` (no login required).
2. **Automatic Management**: Server starts, stops, and monitors tunnel health automatically.
3. **URL Format**: `*.trycloudflare.com`.
4. **Auto-Restart**: Tunnel loop restarts on failure with 5s backoff.
5. **Multiple Tunnels**: Can run multiple tunnels with different IDs.
6. **Health Checks**: HTTP GET to verify tunnel is accessible.
7. **Domain Mode**: Toggle between Cloudflare tunnels and custom domain.

## Related Files

- Tunnel Manager: `internal/cloudflare/tunnel.go`
- Server Integration: `internal/api/server.go` (settings, metrics endpoints)

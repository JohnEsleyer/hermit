# Concurrency

> See also: [Docker Container Management](./container-management.md), [Cloudflared Integration](./cloudflared.md)

## Overview

Hermit uses Go's concurrency primitives (goroutines, mutexes, channels) to handle multiple operations simultaneously. This document covers the concurrency patterns used throughout the system.

## High-Level Flow

```
HTTP Request                    Background Tasks
     │                               │
     ▼                               ▼
┌─────────────────┐          ┌─────────────────┐
│ Fiber Router    │          │ Goroutines      │
│ (sequential)    │          │ (parallel)      │
└────────┬────────┘          └────────┬────────┘
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│ Handler         │          │ Metrics         │
│ (per request)   │          │ Aggregator      │
└────────┬────────┘          └────────┬────────┘
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│ Mutex Guards    │          │ Tunnel Manager  │
│ Shared State   │          │ Background      │
└─────────────────┘          └─────────────────┘
```

## Concurrency Patterns Used

### 1. Mutex for Shared State

**Server** - Protects takeover mode map
**File: `internal/api/server.go`**
```go
type Server struct {
    // ...
    takeoverMode  map[string]bool
    mu            sync.RWMutex  // Protects shared state
    // ...
}

// Usage: Protecting takeover mode toggle
func (s *Server) handleAgentCommand(agent *db.Agent, chatID, text string) error {
    s.mu.Lock()
    active := s.takeoverMode[chatID]
    s.takeoverMode[chatID] = !active
    s.mu.Unlock()
}
```

**Tunnel Manager** - Protects tunnel processes
**File: `internal/cloudflare/tunnel.go`**
```go
type TunnelManager struct {
    mu        sync.Mutex
    processes map[string]*exec.Cmd
    urls      map[string]string
}

// Usage: Protecting process map during tunnel operations
func (m *TunnelManager) StartQuickTunnel(id string, port int) (string, error) {
    m.mu.Lock()
    if _, exists := m.processes[id]; exists {
        url := m.urls[id]
        m.mu.Unlock()
        return url, nil  // Early return with lock release
    }
    // ... create tunnel
}
```

**Docker Client** - Protects metrics cache
**File: `internal/docker/cubicle.go`**
```go
type Client struct {
    cli              *client.Client
    mu               sync.RWMutex
    latestSystem     SystemMetrics
}

// Usage: Read-write lock for metrics cache
func (c *Client) LatestSystemMetrics() (SystemMetrics, error) {
    c.mu.RLock()  // Read lock for cached data
    cached := c.latestSystem
    c.mu.RUnlock()
    if cached.Host.Timestamp > 0 {
        return cached, nil
    }
    // ... collect new metrics
}
```

### 2. Goroutines for Background Tasks

**Docker Metrics Aggregator** - Runs continuously in background
**File: `internal/docker/cubicle.go`**
```go
func (c *Client) StartMetricsAggregator() {
    c.mu.Lock()
    if c.aggregatorActive {
        c.mu.Unlock()
        return
    }
    c.aggregatorActive = true
    c.mu.Unlock()

    // Background goroutine collects metrics every second
    go func() {
        ticker := time.NewTicker(1 * time.Second)
        defer ticker.Stop()

        for {
            metrics, err := c.collectSystemMetrics()
            if err == nil {
                c.mu.Lock()
                c.latestSystem = metrics  // Update shared state
                c.mu.Unlock()
            }
            <-ticker.C
        }
    }()
}
```

**Tunnel Manager** - Background tunnel process management
**File: `internal/cloudflare/tunnel.go`**
```go
func (m *TunnelManager) StartQuickTunnel(id string, port int) (string, error) {
    // Start tunnel loop in background
    go m.runTunnelLoop(ctx, id, port, urlChan)

    // Wait for URL or timeout
    select {
    case url := <-urlChan:
        return url, nil
    case <-time.After(60 * time.Second):
        return "", fmt.Errorf("timeout waiting for tunnel URL")
    }
}

func (m *TunnelManager) runTunnelLoop(ctx context.Context, id string, port int, urlChan chan string) {
    for {
        select {
        case <-ctx.Done():
            return  // Context cancellation
        default:
        }

        // Run tunnel process
        cmd := exec.CommandContext(ctx, "cloudflared", "tunnel", "--url", 
            fmt.Sprintf("http://localhost:%d", port))

        // Parse output in background goroutine
        go func() {
            reader := bufio.NewReader(stderr)
            for {
                line, _ := reader.ReadString('\n')
                if match := urlRe.FindString(line); match != "" {
                    urlChan <- match  // Send URL through channel
                }
            }
        }()

        cmd.Wait()  // Wait for process to exit
        time.Sleep(5 * time.Second)  // Backoff before restart
    }
}
```

### 3. WaitGroups for Parallel Operations

**Docker Metrics Collection** - Parallel collection of host and container metrics
**File: `internal/docker/cubicle.go`**
```go
func (c *Client) collectSystemMetrics() (SystemMetrics, error) {
    var wg sync.WaitGroup
    var host HostMetrics
    var containers []ContainerStats
    var hostErr, contErr error

    // Parallel collection
    wg.Add(2)
    go func() {
        defer wg.Done()
        host, hostErr = c.collectHostMetrics()
    }()
    go func() {
        defer wg.Done()
        containers, contErr = c.collectContainerMetrics()
    }()
    wg.Wait()  // Wait for both to complete

    // ...
}
```

### 4. Context for Cancellation

**Graceful shutdown using context**
```go
func (m *TunnelManager) StartQuickTunnel(id string, port int) (string, error) {
    ctx, cancel := context.WithCancel(context.Background())
    m.cancels[id] = cancel  // Store cancel function
    m.mu.Unlock()

    // Cleanup on timeout
    select {
    case url := <-urlChan:
        return url, nil
    case <-time.After(60 * time.Second):
        cancel()  // Cancel context, stops goroutine
        m.mu.Lock()
        delete(m.cancels, id)
        m.mu.Unlock()
        return "", fmt.Errorf("timeout")
    }
}
```

## Cheatsheet

| Pattern | File | Usage |
|---------|------|-------|
| RWMutex (server) | `server.go:184` | Protects takeover mode map |
| RWMutex (docker) | `cubicle.go:29` | Protects metrics cache |
| Mutex (tunnel) | `tunnel.go:29` | Protects process map |
| Goroutine (metrics) | `cubicle.go:86` | Background metrics collection |
| Goroutine (tunnel) | `tunnel.go:112` | Tunnel output parsing |
| WaitGroup | `cubicle.go:121` | Parallel metrics collection |
| Context | `tunnel.go:51` | Graceful shutdown |

## Thread Safety Summary

| Component | Mutex Type | What it Protects |
|-----------|------------|------------------|
| Server.takeoverMode | sync.RWMutex | Telegram takeover state per chat |
| Server.verifyCodes | map (no mutex) | Verification codes (single-write) |
| TunnelManager.processes | sync.Mutex | Active tunnel processes |
| TunnelManager.urls | sync.Mutex | Tunnel URLs |
| DockerClient.latestSystem | sync.RWMutex | Cached system metrics |

## Key Concurrency Rules

1. **Always release locks**: Use `defer mu.Unlock()` or explicit unlock paths
2. **Use RWMutex for read-heavy operations**: Multiple readers, single writer
3. **Use channels for goroutine communication**: Used in tunnel URL reporting
4. **Use WaitGroup for known number of tasks**: Parallel metric collection
5. **Use context for cancellation**: Graceful shutdown of background tasks

## Related Files

- Server: `internal/api/server.go`
- Docker: `internal/docker/cubicle.go`
- Tunnel: `internal/cloudflare/tunnel.go`

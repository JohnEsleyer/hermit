# Container Management

> See also: [Docker Agent Image](../Dockerfile)

## Overview

Each AI agent runs in an isolated Docker container. The system manages container lifecycle (create, start, stop, remove) and provides file operations within containers.

## High-Level Flow

```
Agent Creation Request
    │
    ▼
┌─────────────────────┐
│  HandleCreateAgent  │
│  (server.go)       │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │ DB Insert │
    └─────┴─────┘
          │
          ▼ (async)
┌─────────────────────┐
│  docker.Run()       │ ◄── Create container if not exists
│  (cubicle.go)      │     Start container if stopped
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Agent Ready       │
│  Container Running │
└─────────────────────┘
```

## Code Flow

### 1. Create Agent (API Handler)
**File: `internal/api/server.go`**
```go
func (s *Server) HandleCreateAgent(c *fiber.Ctx) error {
    // Parse request
    var req struct { Name, Role, Personality, Provider, Model string }
    c.BodyParser(&req)

    // Create agent in database
    a := db.Agent{
        Name:     req.Name,
        Role:     req.Role,
        Provider: req.Provider,
        Model:    req.Model,
    }
    id, err := s.db.CreateAgent(&a)

    // Async: create and start container
    go func() {
        time.Sleep(500 * time.Millisecond)
        containerName := "agent-" + strings.ToLower(existing.Name)
        
        // Run container
        err := s.docker.Run(containerName, image, true)
        if err != nil {
            log.Printf("Failed to create container: %v", err)
        }
    }()

    return c.JSON(fiber.Map{"id": id, "success": true})
}
```

### 2. Run Container (Docker Client)
**File: `internal/docker/cubicle.go`**
```go
func (c *Client) Run(name, image string, detach bool) error {
    ctx := context.Background()

    // 1. Check if container already exists
    inspect, err := c.cli.ContainerInspect(ctx, name)
    if err == nil {
        // Already exists - start if stopped
        if inspect.State.Running {
            return nil
        }
        return c.cli.ContainerStart(ctx, name, types.ContainerStartOptions{})
    }

    // 2. Create new container
    // Check if image exists locally
    images, err := c.cli.ImageList(ctx, types.ImageListOptions{All: true})
    // Pull if not found locally...
    
    // Create container
    resp, err := c.cli.ContainerCreate(ctx, &container.Config{
        Image: image,
        Cmd:   []string{"sleep", "infinity"},  // Keep container running
    }, nil, nil, nil, name)

    // Start container
    return c.cli.ContainerStart(ctx, resp.ID, types.ContainerStartOptions{})
}
```

### 3. Execute Command in Container
**File: `internal/docker/cubicle.go`**
```go
func (c *Client) Exec(containerName string, command string) (string, error) {
    ctx, cancel := context.WithTimeout(context.Background(), c.timeout)
    defer cancel()

    execCfg := types.ExecConfig{
        AttachStdout: true,
        AttachStderr: true,
        Cmd:          []string{"sh", "-c", command},
        WorkingDir:   "/app/workspace/work",
    }

    // Create exec
    idResp, err := c.cli.ContainerExecCreate(ctx, containerName, execCfg)
    if err != nil {
        return "", err
    }

    // Attach and get output
    resp, err := c.cli.ContainerExecAttach(ctx, idResp.ID, types.ExecStartCheck{})
    defer resp.Close()

    out, _ := io.ReadAll(resp.Reader)
    return string(out), nil
}
```

### 4. Container Actions (Start/Stop/Reset)
**File: `internal/api/server.go`**
```go
func (s *Server) HandleContainerAction(c *fiber.Ctx) error {
    containerID := c.Params("id")
    var req struct{ Action string }
    c.BodyParser(&req)

    switch req.Action {
    case "start":
        // Ensure container exists and running
        s.ensureAgentContainer(agent)
    case "stop":
        s.docker.Stop(containerID)
    case "reset":
        s.docker.Stop(containerID)
        s.docker.Remove(containerID)
        s.docker.Run(containerName, image, true)
    }
    return c.JSON(fiber.Map{"success": true})
}
```

## Container Workspace Structure

```
/app/workspace/
├── work/     # Scratchpad for agent operations (commands execute here)
├── in/       # Input files from users
├── out/      # Output files to give to users (via GIVE action)
└── apps/     # Published web apps (via APP action)
```

## Cheatsheet

| Operation | File | Function |
|-----------|------|----------|
| Run Container | `cubicle.go:306` | `Client.Run` |
| Stop Container | `cubicle.go:358` | `Client.Stop` |
| Remove Container | `cubicle.go:363` | `Client.Remove` |
| Execute Command | `cubicle.go:280` | `Client.Exec` |
| Read File | `cubicle.go:419` | `Client.ReadFile` |
| List Files | `cubicle.go:449` | `Client.ListContainerFiles` |
| Is Running | `cubicle.go:400` | `Client.IsRunning` |
| Get Stats | `cubicle.go:384` | `Client.Stats` |
| Container Action API | `server.go:1067` | `HandleContainerAction` |

## Container Lifecycle

```
┌──────────┐    start     ┌─────────┐
│ Stopped  │ ───────────► │ Running │
└──────────┘              └────┬────┘
      ▲                        │
      │ stop                    │ reset
      │                         ▼
      │                   ┌───────────┐
      └────────────────── │ Recreated │
          remove          └───────────┘
```

## Image Used

- **Image**: `hermit-agent:latest`
- **Base**: Built from `Dockerfile` in project root
- **Command**: `sleep infinity` (keeps container running)

## Related Files

- Docker Client: `internal/docker/cubicle.go`
- Container API: `internal/api/server.go` (lines 1047-1132)
- Dockerfile: `Dockerfile` (agent image)

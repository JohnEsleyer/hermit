# Telegram Integration

## Overview

HermitShell agents communicate with users via Telegram using **long polling** for receiving messages. This approach prioritizes architectural simplicity and resilience over the slight efficiency gains of webhooks.

**Why Long Polling?**

| Aspect | Webhooks | Long Polling |
|--------|----------|--------------|
| Setup complexity | Requires public URL + verification | Works on localhost |
| Server restart | Messages lost or need queue | Messages queued by Telegram |
| Development | Need tunnel/ngrok | Test locally |
| Code complexity | ~50 lines + signature validation | ~15 lines |
| Latency | Real-time | 0-30 seconds (configurable) |

For a lightweight, easy-to-setup system like HermitShell, long polling provides the best balance of simplicity and reliability.

## High-Level Flow

```
Telegram User
     │
     ▼
┌─────────────────────────────────────┐
│  HermitShell Server                 │
│                                     │
│  Telegram Server ◄────── Long Poll  │
│  (getUpdates)      │               │
│                    │               │
│              ┌─────┴─────┐        │
│              │ Process   │        │
│              │ Messages  │        │
│              └─────┬─────┘        │
│                    │               │
│              ┌─────┴─────┐        │
│              │           │        │
│              ▼           ▼        │
│         Commands     AI Processing │
│         (status,     (LLM call    │
│          help, etc)   + XML)       │
└─────────────────────────────────────┘
```

## Architecture

### Polling Manager

Each agent with a Telegram token runs a dedicated polling goroutine:

```
┌──────────────────────────────────────────────┐
│ Server                                      │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Polling Manager                      │   │
│  │                                      │   │
│  │  pollers map[agentID]cancelFunc     │   │
│  │                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │ Agent 1     │  │ Agent 2     │   │   │
│  │  │ Poller     │  │ Poller     │   │   │
│  │  │ (goroutine)│  │ (goroutine)│   │   │
│  │  └─────┬───────┘  └─────┬───────┘   │   │
│  │        │                │           │   │
│  └────────┼────────────────┼───────────┘   │
│           ▼                ▼               │
│     Telegram API ◄──── getUpdates()        │
└────────────────────────────────────────────┘
```

### Key Functions

| Function | Purpose |
|---------|---------|
| `StartPollingForAgent()` | Start a polling goroutine for an agent |
| `StopPollingForAgent()` | Stop the polling goroutine |
| `StartAgentPoller()` | Main polling loop (delete webhook, get updates, process) |
| `ProcessTelegramUpdate()` | Handle incoming message (auth, commands, AI) |

## Code Flow

### 1. Telegram Bot (Library)

**File: `internal/telegram/telegram.go`**

```go
// DeleteWebhook removes any existing webhook before polling.
// Required because Telegram blocks getUpdates when webhook is active.
func (b *Bot) DeleteWebhook() error {
    url := fmt.Sprintf("%s/bot%s/deleteWebhook", b.apiURL, b.token)
    resp, err := b.http.Get(url)
    defer resp.Body.Close()
    return err
}

// GetUpdates performs long polling to fetch updates from Telegram.
// offset: last update_id + 1 to acknowledge processed updates.
// timeout: seconds to wait (long polling duration).
func (b *Bot) GetUpdates(offset int64, timeout int) ([]Update, error) {
    url := fmt.Sprintf("%s/bot%s/getUpdates?offset=%d&timeout=%d", 
        b.apiURL, b.token, offset, timeout)
    resp, err := b.http.Get(url)
    defer resp.Body.Close()
    
    var result struct {
        OK     bool      `json:"ok"`
        Result []Update  `json:"result"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Result, nil
}
```

### 2. Polling Loop

**File: `internal/api/server.go`**

```go
func (s *Server) StartAgentPoller(ctx context.Context, agent *db.Agent) {
    bot := telegram.NewBot(agent.TelegramToken)
    
    // Clear any existing webhook before polling
    bot.DeleteWebhook()
    
    var offset int64 = 0
    
    for {
        select {
        case <-ctx.Done():
            log.Printf("Agent %s: Stopping Telegram poller", agent.Name)
            return
        default:
            // 30 second timeout for long polling
            updates, err := bot.GetUpdates(offset, 30)
            if err != nil {
                log.Printf("Agent %s: Polling error: %v", agent.Name, err)
                time.Sleep(5 * time.Second) // backoff on error
                continue
            }
            
            for _, update := range updates {
                if update.UpdateID >= offset {
                    offset = update.UpdateID + 1 // Advance offset
                }
                // Process update concurrently
                go s.ProcessTelegramUpdate(agent, update)
            }
        }
    }
}
```

### 3. Message Processing

**File: `internal/api/server.go`**

```go
func (s *Server) ProcessTelegramUpdate(agent *db.Agent, update telegram.Update) {
    if update.Message == nil || update.Message.Text == "" {
        return
    }
    
    chatID := fmt.Sprintf("%d", update.Message.Chat.ID)
    userText := strings.TrimSpace(update.Message.Text)
    userID := fmt.Sprintf("%d", update.Message.From.ID)
    
    // Authorization check
    allowed := s.checkUserAuthorization(agent, userID, update.Message.From.Username)
    
    if !allowed {
        bot := telegram.NewBot(agent.TelegramToken)
        bot.SendMessage(chatID, "You are not authorized to use this agent.")
        return
    }
    
    // Handle commands or pass to AI
    if strings.HasPrefix(userText, "/") {
        s.handleAgentCommand(agent, chatID, userText)
        return
    }
    
    // Process with AI
    s.db.AddHistory(agent.ID, userID, "user", userText)
    go s.processAgentAIRequest(agent, chatID, userID, userText)
}
```

## Agent Lifecycle Integration

Polling is automatically managed based on agent state:

| Event | Action |
|-------|--------|
| Agent created with Telegram token | Start polling |
| Telegram token updated | Restart polling |
| Agent deleted | Stop polling |
| Server starts | Start polling for all agents with tokens |

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show available commands |
| `/status` | Show agent configuration and polling status |
| `/clear` | Clear chat history |
| `/reset` | Reset container |
| `/takeover` | Toggle manual XML mode |
| `/give_system_prompt` | Get agent personality |
| `/give_context` | Get conversation history |

## Authorization

Users must be in the agent's `allowed_users` list to interact. If `allowed_users` is empty, anyone can interact.

```
allowed_users: "123456789,username1,username2"
```

## Related Files

- Telegram Bot Library: `internal/telegram/telegram.go`
- Polling Manager: `internal/api/server.go` (StartAgentPoller, ProcessTelegramUpdate)
- Command Handler: `internal/api/server.go` (handleAgentCommand)
- AI Processing: `internal/api/server.go` (processAgentAIRequest)

# Telegram Integration

## Overview

Hermit agents communicate with users via Telegram. The system uses Telegram Bot API webhooks for receiving messages and sends messages using the Bot API.

## High-Level Flow

```
Telegram User
     │
     ▼
┌─────────────────────┐
│  Telegram Server    │
│  (webhook push)    │
└─────────┬───────────┘
          │ POST /api/webhook/:agentId
          ▼
┌─────────────────────┐
│ HandleAgentWebhook  │
│ (server.go)        │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │ Auth      │
    │ Check     │
    └─────┬─────┘
          │
          ▼ (if allowed)
┌─────────────────────┐
│  Command or        │
│  AI Processing    │
└─────────┬───────────┘
          │
    ┌─────┴────────────────────┐
    │                           │
    ▼                           ▼
┌───────────┐          ┌───────────────┐
│ /status   │          │ processAgent  │
│ /help     │          │ AIRequest     │
│ /clear    │          │ (LLM)         │
│ /reset    │          └───────┬───────┘
│ /takeover │                  │
└───────────┘          ┌───────┴───────┐
                      │               │
                      ▼               ▼
              ┌───────────────┐ ┌─────────────┐
              │ ExecuteXML   │ │ Send Message│
              │ Payload      │ │ (telegram)  │
              └──────────────┘ └─────────────┘
```

## Code Flow

### 1. Telegram Bot (Library)
**File: `internal/telegram/telegram.go`**
```go
type Bot struct {
    token  string
    apiURL string
    http   *http.Client
}

func NewBot(token string) *Bot {
    return &Bot{
        token:  token,
        apiURL: "https://api.telegram.org",
        http: &http.Client{Timeout: 30 * time.Second},
    }
}

// Send a message to a chat
func (b *Bot) SendMessage(chatID, text string) error {
    req := SendMessageRequest{
        ChatID: chatID,
        Text:   text,
    }
    body, _ := json.Marshal(req)
    
    url := fmt.Sprintf("%s/bot%s/sendMessage", b.apiURL, b.token)
    resp, err := b.http.Post(url, "application/json", bytes.NewReader(body))
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("API error: %d", resp.StatusCode)
    }
    return nil
}
```

### 2. Webhook Handler
**File: `internal/api/server.go`**
```go
func (s *Server) HandleAgentWebhook(c *fiber.Ctx) error {
    agentId, _ := strconv.ParseInt(c.Params("agentId"), 10, 64)
    agent, _ := s.db.GetAgent(agentId)

    // Parse Telegram update
    var update telegram.Update
    c.BodyParser(&update)

    chatID := fmt.Sprintf("%d", update.Message.Chat.ID)
    userText := strings.TrimSpace(update.Message.Text)
    userID := fmt.Sprintf("%d", update.Message.From.ID)

    // Authorization check
    allowed := false
    if agent.AllowedUsers == "" {
        allowed = true  // No restrictions
    } else {
        // Check if userID or username in allowed list
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
        bot := telegram.NewBot(agent.TelegramToken)
        bot.SendMessage(chatID, "You are not authorized to use this agent.")
        return c.SendStatus(200)
    }

    // Handle commands or pass to AI
    if strings.HasPrefix(userText, "/") {
        return s.handleAgentCommand(agent, chatID, userText)
    }

    // Save to history and process with AI
    s.db.AddHistory(agentId, userID, "user", userText)
    go s.processAgentAIRequest(agent, chatID, userID, userText)

    return c.SendStatus(200)
}
```

### 3. Agent Command Handler
**File: `internal/api/server.go`**
```go
func (s *Server) handleAgentCommand(agent *db.Agent, chatID, text string) error {
    bot := telegram.NewBot(agent.TelegramToken)
    cmd := strings.Split(text, " ")[0]

    switch cmd {
    case "/status":
        statusMsg := fmt.Sprintf("Agent: %s\nModel: %s\nProvider: %s", 
            agent.Name, agent.Model, agent.Provider)
        bot.SendMessage(chatID, statusMsg)

    case "/help":
        bot.SendMessage(chatID, "Commands: /status, /help, /clear, /reset, /takeover")

    case "/clear":
        s.db.ClearHistory(agent.ID)
        bot.SendMessage(chatID, "Context cleared!")

    case "/reset":
        if agent.ContainerID != "" {
            s.docker.Stop(agent.ContainerID)
            s.docker.Remove(agent.ContainerID)
        }
        bot.SendMessage(chatID, "Container reset.")

    case "/takeover":
        // Toggle manual XML input mode
        s.mu.Lock()
        s.takeoverMode[chatID] = !s.takeoverMode[chatID]
        s.mu.Unlock()
        bot.SendMessage(chatID, "Takeover mode: " + 
            map[bool]string{true: "ON", false: "OFF"}[s.takeoverMode[chatID]])
    }
    return nil
}
```

### 4. AI Request Processing
**File: `internal/api/server.go`**
```go
func (s *Server) processAgentAIRequest(agent *db.Agent, chatID, userID, userText string) {
    bot := telegram.NewBot(agent.TelegramToken)

    // Send "thinking" message
    bot.SendMessage(chatID, "Thinking...")

    // Get LLM client
    client := s.getLLMClientForAgent(agent)

    // Build messages with history
    history, _ := s.db.GetHistory(agent.ID, 10)
    var messages []llm.Message
    messages = append(messages, llm.Message{Role: "system", Content: systemPrompt})
    // Add history...

    // Call LLM
    response, err := client.Chat(agent.Model, messages)

    // Execute XML actions from response
    feedback := s.ExecuteXMLPayload(agent.ID, chatID, response, bot)

    // Save to history
    s.db.AddHistory(agent.ID, "assistant", "assistant", response)
}
```

## Cheatsheet

| Operation | File | Function |
|-----------|------|----------|
| Bot Library | `telegram.go` | `Bot` struct |
| Send Message | `telegram.go:113` | `Bot.SendMessage` |
| Send Document | `telegram.go:189` | `Bot.SendDocument` |
| Webhook Handler | `server.go:1765` | `HandleAgentWebhook` |
| Command Handler | `server.go:1851` | `handleAgentCommand` |
| AI Processing | `server.go:1957` | `processAgentAIRequest` |
| XML Execution | `server.go:2167` | `ExecuteXMLPayload` |

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show available commands |
| `/status` | Show agent configuration |
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
- Webhook Handler: `internal/api/server.go` (lines 1765-1849)
- Command Handler: `internal/api/server.go` (lines 1851-1955)
- AI Processing: `internal/api/server.go` (lines 1957-2041)

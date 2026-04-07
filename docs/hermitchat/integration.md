# HermitChat Integration Guide

> HermitChat is the mobile companion app for HermitShell, built with Flutter.

## Overview

HermitChat allows you to manage and interact with HermitShell agents from your mobile device. It provides:
- Real-time chat with agents
- Agent management and creation
- System metrics monitoring
- Web app browsing
- Calendar integration

## How It Works

### Architecture

```
┌─────────────────┐     HTTP/REST      ┌─────────────────┐
│   HermitChat    │ ◄─────────────────► │   HermitShell   │
│   (Mobile App)  │     WebSocket      │   (Server)      │
└─────────────────┘                    └────────┬────────┘
                                                │
                                        ┌───────┴───────┐
                                        │               │
                                   ┌─────▼─────┐   ┌───▼────┐
                                   │ Telegram  │   │ Docker │
                                   │   Bot     │   │  Agent │
                                   └───────────┘   └────────┘
```

### Communication Flow

1. **Login**: User enters server URL and admin credentials (`admin`/`hermit123`)
2. **Agent List**: App fetches available agents via `GET /api/agents`
3. **Chat**: Messages sent via `POST /api/agents/:id/chat`
4. **Real-time Updates**: WebSocket connection at `ws://server/api/ws`

## Agent Configuration

### Platform Setting

When creating an agent, set `platform` to `"hermitchat"` instead of `"telegram"`:

| Setting | Telegram | HermitChat |
|---------|----------|------------|
| Platform | `telegram` | `hermitchat` |
| Telegram Token | Required | Not needed |
| Bot Username | Auto-linked | N/A |

### API Differences

**Telegram Agent:**
```go
agent.Platform = "telegram"
agent.TelegramToken = "123456:ABC..."
// Messages go through Telegram Bot API
```

**HermitChat Agent:**
```go
agent.Platform = "hermitchat"
// Messages go through REST API, pushed via WebSocket
```

## API Endpoints

### Chat
```
POST /api/agents/:id/chat
Body: { "message": "Hello" }
Response: { "message": "Agent response", "role": "assistant" }
```

### Agent List
```
GET /api/agents
Response: [{ "id": 1, "name": "Ralph", "platform": "hermitchat", ... }]
```

### Get Messages (via WebSocket)
```
ws://server/api/ws

// Incoming message format:
{
  "type": "new_message",
  "agent_id": 1,
  "user_id": "mobile",
  "role": "assistant",
  "content": "Hello!"
}

// Conversation cleared:
{ "type": "conversation_cleared", "agent_id": 1 }
```

## Command Palette

In HermitChat chat input, type:
- `/` → Shows slash commands
- `<` → Shows XML tag snippets

### Slash Commands

| Command | Description |
|---------|-------------|
| `/status` | Show agent configuration & health |
| `/reset` | Restart Docker container |
| `/clear` | Clear conversation history |
| `/files` | List files in out folder |

### XML Tag Snippets

Type `<` to see available tags:

| Tag | Description |
|-----|-------------|
| `<message>` | Send message to user |
| `<terminal>` | Execute terminal command |
| `<give>` | Send file from out folder |
| `<app>` | Create web application |
| `<deploy>` | Publish web application |
| `<skill>` | Load skill context |
| `<calendar>` | Schedule calendar event |
| `<thought>` | Internal thought (not sent to user) |
| `<system>` | Request system info |

> **Note**: Selecting an item inserts it into the chat box for editing before sending.

## Takeover Mode

HermitChat supports takeover mode for direct XML control:

1. Type `/takeover` to enable
2. Send XML commands directly (e.g., `<terminal>ls</terminal>`)
3. Type `/takeover` again to disable

## File Delivery

Files in `/app/workspace/out/` are delivered as attachments in the chat:
- Images → Inline photo
- Videos → Inline video  
- Documents → File attachment

## Mobile App Screens

1. **Agents** - List and select agents for chat
2. **Dashboard** - System metrics (CPU, memory, network)
3. **Apps** - Browse agent-deployed web apps (WebView)
4. **Calendar** - View and manage scheduled events
5. **Settings** - Configure API keys, tunnel, timezone

## Security

- Session-based authentication (cookies)
- Credentials stored securely on device
- Supports HTTP Basic Auth fallback
- Encryption for sensitive data in transit
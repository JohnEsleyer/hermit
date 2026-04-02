# LLM Agent Processing Flow

> This document describes how HermitShell processes user messages through the LLM agent and executes XML actions.

## Overview

When a user sends a message to an agent, HermitShell follows this pipeline:

```
User Message → LLM → XML Parser → Action Executor → User Response
```

## Processing Pipeline

### 1. Request Receipt

When a message is received (via Telegram or HermitChat):

```go
// internal/api/server.go:2737
func (s *Server) processAgentAIRequest(agent *db.Agent, chatID, userID, userText string)
```

**What happens:**
1. System time is injected into the message for AI context
2. "Thinking..." message is sent to user (Telegram only)
3. Conversation history is fetched from database
4. System prompt is built from `context.md` + agent personality

### 2. Context Building

The LLM receives a message array:

```go
messages = [
    {Role: "system", Content: context.md + agent.Personality},
    {Role: "user", Content: "[Current System Time: 2026-01-02 15:04:05] User message"},
    {Role: "user", Content: "Previous message 1"},
    {Role: "assistant", Content: "Previous response 1"},
    ...
]
```

- `context.md` provides base instructions (XML tags, workspace structure)
- Agent personality is appended
- History is included (last 10 messages by default)

### 3. LLM Response

The LLM processes the messages and returns a response containing:
- Text visible to user (wrapped in `<message>` tags)
- Actions to execute (XML tags)
- Internal reasoning (optional `<thought>`)

### 4. XML Parsing

The parser (`internal/parser/contract.go`) extracts all tags:

```go
// ParsedResponse contains:
Thought   string           // Internal reasoning
Message   string           // Visible text to user
Terminals []string         // Commands to execute
System    string           // System info request
Actions   []ParsedAction  // GIVE, SKILL actions
Calendars []ParsedCalendar // Calendar CRUD
Apps      []ParsedApp      // Web apps to create
Deploys   []string        // Apps to publish
```

### 5. Action Execution

`ExecuteXMLPayload()` processes each tag in order:

```
<thought> → <message> → <terminal> → <give> → <app> → <deploy> → <skill> → <system> → <calendar>
```

---

## Scenario Examples

### Scenario 1: Simple Text Response

**User sends:**
```
Hello, how are you?
```

**LLM returns:**
```xml
<message>I'm doing great, thank you for asking! How can I help you today?</message>
```

**Processing:**
1. Parser extracts `<message>` content
2. `ExecuteXMLPayload` sends message to user via Telegram/HermitChat
3. Response appears in chat

---

### Scenario 2: Terminal Command

**User sends:**
```
List the files in my workspace
```

**LLM returns:**
```xml
<message>Let me check your workspace.</message>
<terminal>ls -la /app/workspace/work</terminal>
```

**Processing:**
1. Message sent to user first
2. Terminal command executed in Docker container
3. Output logged but NOT shown to user (internal)
4. Feedback JSON logged to history

**Container output:**
```json
{"terminal": "ls -la /app/workspace/work", "status": "SUCCESS", "output": "total 8\ndrwxr-xr-x 1 root root 4096 Jan 1 00:00 .\nddrwxrwxr-x 1 root root 4096 Jan 1 00:00 .."}
```

---

### Scenario 3: File Delivery

**User sends:**
```
Send me the report.pdf file
```

**LLM returns:**
```xml
<message>Here is the report you requested.</message>
<give>report.pdf</give>
```

**Processing:**
1. Message sent to user
2. System reads `/app/workspace/out/report.pdf` from container
3. File sent as Telegram document/photo/video (based on extension)
4. File delivered to HermitChat as attachment

**Error case:** If file doesn't exist:
```json
{"action": "GIVE", "file": "report.pdf", "status": "FAILED", "error": "File not found in container"}
```

---

### Scenario 4: Web App Creation

**User sends:**
```
Create a simple calculator app
```

**LLM returns:**
```xml
<message>I'll create a calculator app for you!</message>
<app name="calculator">
<html>
  <input id="a" type="number">
  <button onclick="alert(document.getElementById('a').value)">Click</button>
</html>
</app>
```

**Processing:**
1. `<app>` tag triggers folder creation: `/app/workspace/apps/calculator/`
2. `index.html` created with embedded content
3. App stored but NOT yet published (user doesn't get URL)

---

### Scenario 5: App Deployment

**User sends:**
```
Publish the calculator app
```

**LLM returns:**
```xml
<message>Your calculator is now live!</message>
<deploy>calculator</deploy>
```

**Processing:**
1. System verifies app exists in `/app/workspace/apps/calculator/`
2. Generates public URL: `https://tunnel-url/apps/{agent-id}/calculator`
3. Sends URL to user via message

**Response:**
```
🚀 App Deployed: calculator
Access it here: https://xxx.trycloudflare.com/apps/1/calculator
```

---

### Scenario 6: Skill Loading

**User sends:**
```
Use the python skill for this task
```

**LLM returns:**
```xml
<message>Loading the Python skill...</message>
<skill>python-coding</skill>
```

**Processing:**
1. System reads `data/skills/python-coding.md`
2. Content injected into conversation as system message
3. Agent now has Python context for subsequent responses

---

### Scenario 7: Calendar Event

**User sends:**
```
Remind me to call John at 3pm today
```

**LLM returns:**
```xml
<message>I've scheduled a reminder for 3:00 PM.</message>
<calendar>
<datetime>2026-01-02T15:00:00</datetime>
<prompt>Call John</prompt>
</calendar>
```

**Processing:**
1. Event created in database with datetime and prompt
2. Background scheduler checks events
3. At scheduled time, reminder sent to user

---

### Scenario 8: Calendar List

**User sends:**
```
What reminders do I have?
```

**LLM returns:**
```xml
<message>Let me check your calendar.</message>
<calendar action="list"/>
```

**Processing:**
1. System fetches all calendar events for this agent
2. Events formatted and added to history
3. User sees list of pending/completed events

---

### Scenario 9: Calendar Delete

**User sends:**
```
Cancel the 3pm reminder
```

**LLM returns:**
```xml
<message>I've cancelled the 3:00 PM reminder.</message>
<calendar action="delete" id="1"/>
```

**Processing:**
1. Event with ID 1 deleted from database
2. Confirmation added to history

---

### Scenario 10: System Info

**User sends:**
```
What's the current memory usage?
```

**LLM returns:**
```xml
<message>Current memory usage is...</message>
<system>memory</system>
```

**Processing:**
1. System reads host memory from `/proc` or Docker stats
2. Value returned in feedback (not sent to user)

---

### Scenario 11: Multiple Actions

**User sends:**
```
Create a todo app and deploy it
```

**LLM returns:**
```xml
<thought>User wants a todo app. I'll create it and deploy in one response.</thought>
<message>Creating and deploying your todo app now!</message>
<app name="todo">
<html>
  <input id="task"><button onclick="add()">Add</button>
  <ul id="list"></ul>
</html>
<script>
function add() {
  document.getElementById('list').innerHTML += '<li>'+document.getElementById('task').value+'</li>';
}
</script>
</app>
<deploy>todo</deploy>
```

**Processing:**
1. `<thought>` - logged internally only
2. `<message>` - sent to user
3. `<app>` - creates app in container
4. `<deploy>` - generates public URL and sends to user

---

### Scenario 12: Error Handling - No Message Tag

**LLM returns (MISTAKE):**
```
Hello! Here's my response without any XML tags.
```

**Result:** 
- Message is NOT sent to user
- Plain text outside `<message>` tags is IGNORED by the system

**This is critical:** All visible user text MUST be wrapped in `<message>` tags.

---

### Scenario 13: Error Handling - LLM Failure

**When LLM API fails:**
1. "Thinking..." message deleted
2. Error message sent to user: `"Error communicating with AI: <error>"`
3. Error logged to history
4. Audit log entry created

---

### Scenario 14: Takeover Mode

When user sends `/takeover`:
1. System enters takeover mode
2. User can send XML commands directly (no LLM)
3. Commands parsed and executed immediately

**Example:**
```
<terminal>echo "Hello from takeover"</terminal>
<give>output.txt</give>
```

---

## Checkpoint System

The parser uses `<end>` as a checkpoint marker:

```xml
<message>First part</message>
<terminal>cmd1</terminal>
<end>
<message>This won't execute</message>
```

Only content before `<end>` is processed. This prevents re-execution of old actions.

---

## Logging

All actions are logged to:
- **Database**: `audit_logs` table
- **History**: Messages stored with role (user/assistant/system)

**Log categories:**
- `ai_processing` - LLM request/response
- `terminal_execute` / `terminal_success` / `terminal_failed`
- `action_give` / `action_give_failed`
- `action_app_created` / `action_app_deployed`
- `action_skill` / `action_skill_failed`
- `llm_error` - API failures

---

## Related Files

| File | Purpose |
|------|---------|
| `internal/api/server.go` | `processAgentAIRequest()`, `ExecuteXMLPayload()` |
| `internal/parser/contract.go` | `ParseLLMOutput()` |
| `internal/db/db.go` | History and audit log storage |
| `docs/xml-tags.md` | XML tag reference |
| `context.md` | Agent base instructions |
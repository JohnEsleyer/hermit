# Time Management

> See also: [Settings Tab](../dashboard/src/components/SettingsTab.tsx), [API Endpoints](./api-endpoints.md)

## Overview

Hermit implements a time offset system that allows users to display a different time than the server's actual system time. This is essential when the server is hosted in a different timezone than the user.

## High-Level Flow

```
User Request (Browser)
        │
        ▼
┌─────────────────────────────────────┐
│  Settings Tab (Frontend)            │
│  - Select timezone offset          │
│  - Preview time before saving      │
└─────────────┬───────────────────────┘
              │ POST /api/settings
              ▼
┌─────────────────────────────────────┐
│  HandleSetSettings (server.go)     │
│  - Save timeOffset to DB           │
│  - Save timezone to DB             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  SQLite Database                   │
│  - settings table                 │
│  - key: 'time_offset'              │
│  - key: 'timezone'                │
└─────────────────────────────────────┘

Request Time Display
        │
        ▼
┌─────────────────────────────────────┐
│  HandleGetTime (server.go)         │
│  - Get time_offset from DB         │
│  - Get UTC time from server       │
│  - Apply offset: UTC + offset      │
│  - Return 12-hour format          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Frontend Components              │
│  - Header clock (App.tsx)         │
│  - Settings preview               │
│  - Calendar events                │
└─────────────────────────────────────┘
```

## Code Flow

### 1. Save Time Settings (Frontend)
**File: `dashboard/src/components/SettingsTab.tsx`**
```typescript
const handleSave = async () => {
  // Send timeOffset to backend
  await fetch(`${API_BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeOffset: settings.timeOffset,
      timezone: settings.timezone,
    }),
  });
};
```

### 2. Save Time Settings (Backend)
**File: `internal/api/server.go`**
```go
func (s *Server) HandleSetSettings(c *fiber.Ctx) error {
    var req struct {
        Timezone   string `json:"timezone"`
        TimeOffset string `json:"timeOffset"`
    }
    c.BodyParser(&req)

    // Save time settings to database
    if req.Timezone != "" {
        s.db.SetSetting("timezone", req.Timezone)
    }
    if req.TimeOffset != "" {
        s.db.SetSetting("time_offset", req.TimeOffset)
    }

    return c.JSON(fiber.Map{"success": true})
}
```

### 3. Get Time (Backend)
**File: `internal/api/server.go`**
```go
func (s *Server) HandleGetTime(c *fiber.Ctx) error {
    timezone, _ := s.db.GetSetting("timezone")
    timeOffset, _ := s.db.GetSetting("time_offset")

    // Get current UTC time from server
    currentTime := time.Now().UTC()

    // Apply offset to get user's desired time
    offsetHours := 0
    if timeOffset != "" {
        fmt.Sscanf(timeOffset, "%d", &offsetHours)
    }
    currentTime = currentTime.Add(time.Duration(offsetHours) * time.Hour)

    // Format time in UTC for consistent display
    utcTime := currentTime.UTC()

    return c.JSON(fiber.Map{
        "time":     utcTime.Format("03:04:05 PM"),      // 12-hour with seconds
        "time12":   utcTime.Format("3:04 PM"),          // 12-hour short
        "date":     utcTime.Format("Mon, Jan 2"),       // Day, Mon DD
        "timezone": timezone,
        "timeOffset": timeOffset,
    })
}
```

### 4. Display Time (Frontend Header)
**File: `dashboard/src/App.tsx`**
```typescript
function SystemClock() {
  const [time, setTime] = useState({ time: '', date: '' });

  useEffect(() => {
    // Fetch time every second
    const fetchTime = async () => {
      const res = await fetch(`${API_BASE}/api/time`);
      const data = await res.json();
      setTime(data);
    };
    fetchTime();
    const interval = setInterval(fetchTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <span>{time.time}</span>  {/* 03:04:05 PM */}
      <span>{time.date}</span>  {/* Tue, Mar 17 */}
    </div>
  );
}
```

### 5. Preview Time (Settings Tab)
**File: `dashboard/src/components/SettingsTab.tsx`**
```typescript
// Calculate preview based on selected offset
const getPreviewTime = () => {
  const now = new Date();
  const offset = parseInt(settings.timeOffset || '0');
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const preview = new Date(utc + (3600000 * offset));
  return preview.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: true 
  });
};
```

## Cheatsheet

| Operation | File | Function |
|-----------|------|----------|
| Save settings | `server.go:1597` | `HandleSetSettings` |
| Get time | `server.go:1637` | `HandleGetTime` |
| Set setting | `db.go:280` | `GetSetting` |
| Set setting | `db.go:266` | `SetSetting` |
| Header clock | `App.tsx:29` | `SystemClock` |
| Settings preview | `SettingsTab.tsx:47` | `getPreviewTime` |

## Database Schema

```sql
-- Settings table stores key-value pairs
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Keys used for time management:
-- 'timezone'   - User's selected timezone name (e.g., "Asia/Manila")
-- 'time_offset' - Offset from UTC in hours (e.g., "8")
```

## Time Offset Logic

```
Displayed Time = Server UTC Time + Offset

Examples:
- Server UTC: 11:50 PM
- Offset: +8 (Philippines)
- Displayed: 7:50 AM

- Server UTC: 11:50 PM  
- Offset: -5 (New York EST)
- Displayed: 6:50 PM
```

## Available Timezone Presets

| Offset | Location |
|--------|----------|
| +8 | Philippines, Singapore, Hong Kong |
| +9 | Tokyo, Seoul |
| +1 | Paris, Berlin, Rome |
| 0 | UTC, London |
| -5 | New York, Eastern Time |
| -8 | Los Angeles, Pacific Time |
| +5 | Dubai |
| +3 | Moscow |

## Display Format

All times are displayed in 12-hour format with AM/PM:

- **Full time**: `03:04:05 PM`
- **Short time**: `3:04 PM`
- **Date**: `Tue, Mar 17`

## Related Files

- Settings UI: `dashboard/src/components/SettingsTab.tsx`
- Header Clock: `dashboard/src/App.tsx`
- Calendar: `dashboard/src/components/CalendarTab.tsx`
- Time API: `internal/api/server.go` (HandleGetTime, HandleSetSettings)
- Settings DB: `internal/db/db.go` (GetSetting, SetSetting)

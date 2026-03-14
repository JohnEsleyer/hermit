package telegram

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestBotSendMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-key/sendMessage" {
			t.Errorf("expected path /bottest-key/sendMessage, got %s", r.URL.Path)
		}

		var req SendMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}

		if req.ChatID != "123456" {
			t.Errorf("expected chat_id 123456, got %s", req.ChatID)
		}
		if req.Text != "Hello" {
			t.Errorf("expected text Hello, got %s", req.Text)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ok": true,
			"result": map[string]interface{}{
				"message_id": 1,
			},
		})
	}))
	defer server.Close()

	bot := NewBot("test-key", WithAPIURL(server.URL))
	err := bot.SendMessage("123456", "Hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBotSendDocument(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "hermit-*.pdf")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test content")
	tmpFile.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-key/sendDocument" {
			t.Errorf("expected path /bottest-key/sendDocument, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ok": true,
		})
	}))
	defer server.Close()

	bot := NewBot("test-key", WithAPIURL(server.URL))
	err = bot.SendDocument("123456", tmpFile.Name(), "file.pdf")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestBotSendPhoto(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "hermit-*.png")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.WriteString("test image content")
	tmpFile.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ok": true,
		})
	}))
	defer server.Close()

	bot := NewBot("test-key", WithAPIURL(server.URL))
	err = bot.SendPhoto("123456", tmpFile.Name(), "image.png")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestParseUpdate(t *testing.T) {
	jsonData := `{
		"update_id": 123456,
		"message": {
			"message_id": 1,
			"from": {"id": 111, "is_bot": false, "first_name": "John"},
			"chat": {"id": 111, "type": "private"},
			"text": "Hello bot"
		}
	}`

	var update Update
	err := json.Unmarshal([]byte(jsonData), &update)
	if err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if update.Message.Text != "Hello bot" {
		t.Errorf("expected text Hello bot, got %s", update.Message.Text)
	}
	if update.Message.From.ID != 111 {
		t.Errorf("expected from id 111, got %d", update.Message.From.ID)
	}
}

func TestParseCallbackQuery(t *testing.T) {
	jsonData := `{
		"update_id": 123456,
		"callback_query": {
			"id": "callback123",
			"from": {"id": 111, "first_name": "John"},
			"data": "approve"
		}
	}`

	var update Update
	err := json.Unmarshal([]byte(jsonData), &update)
	if err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if update.CallbackQuery.Data != "approve" {
		t.Errorf("expected data approve, got %s", update.CallbackQuery.Data)
	}
	if update.CallbackQuery.ID != "callback123" {
		t.Errorf("expected callback id callback123, got %s", update.CallbackQuery.ID)
	}
}

func TestBotSendMessageWithID(t *testing.T) {
	var receivedMessageID float64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-key/sendMessage" {
			t.Errorf("expected path /bottest-key/sendMessage, got %s", r.URL.Path)
		}

		var req SendMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}

		if req.ChatID != "123456" {
			t.Errorf("expected chat_id 123456, got %s", req.ChatID)
		}
		if req.Text != "Thinking..." {
			t.Errorf("expected text Thinking..., got %s", req.Text)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ok": true,
			"result": map[string]interface{}{
				"message_id": 42,
			},
		})
	}))
	defer server.Close()

	bot := NewBot("test-key", WithAPIURL(server.URL))
	msgID, err := bot.SendMessageWithID("123456", "Thinking...")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msgID != "42" {
		t.Errorf("expected message ID 42, got %s", msgID)
	}
	_ = receivedMessageID
}

func TestBotDeleteMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-key/deleteMessage" {
			t.Errorf("expected path /bottest-key/deleteMessage, got %s", r.URL.Path)
		}

		var req struct {
			ChatID    string `json:"chat_id"`
			MessageID string `json:"message_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}

		if req.ChatID != "123456" {
			t.Errorf("expected chat_id 123456, got %s", req.ChatID)
		}
		if req.MessageID != "42" {
			t.Errorf("expected message_id 42, got %s", req.MessageID)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ok": true,
		})
	}))
	defer server.Close()

	bot := NewBot("test-key", WithAPIURL(server.URL))
	err := bot.DeleteMessage("123456", "42")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

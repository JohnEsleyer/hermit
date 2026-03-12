package llm

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOpenRouterRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			t.Error("expected Authorization header")
		}

		var req map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"choices": []map[string]interface{}{
				{
					"message": map[string]interface{}{
						"content": "<thought>Test thought</thought><message>Test message</message>",
					},
				},
			},
		})
	}))
	defer server.Close()

	client := NewClient(WithBaseURL(server.URL), WithAPIKey("test-key"))
	resp, err := client.Chat("test-model", []Message{
		{Role: "user", Content: "Hello"},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(resp, "Test message") {
		t.Errorf("expected response to contain Test message, got: %s", resp)
	}
}

func TestOpenRouterStreamRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"<thought>Stream\"}}]}\n\n"))
		w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"<message>Test\"}}]}\n\n"))
		w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	client := NewClient(WithBaseURL(server.URL), WithAPIKey("test-key"))

	var result strings.Builder
	err := client.StreamChat("test-model", []Message{
		{Role: "user", Content: "Hello"},
	}, func(content string) error {
		result.WriteString(content)
		return nil
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(result.String(), "Stream") {
		t.Errorf("expected stream to contain Stream, got: %s", result.String())
	}
}

func TestMessageFormat(t *testing.T) {
	messages := []Message{
		{Role: "system", Content: "You are helpful."},
		{Role: "user", Content: "Hello"},
		{Role: "assistant", Content: "Hi there!"},
		{Role: "user", Content: "How are you?"},
	}

	expected := `[{"role":"system","content":"You are helpful."},{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi there!"},{"role":"user","content":"How are you?"}]`

	formatted := FormatMessages(messages)
	if formatted != expected {
		t.Errorf("expected %s, got %s", expected, formatted)
	}
}

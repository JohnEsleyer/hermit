package api

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func getProjectRoot() string {
	_, currentFile, _, _ := runtime.Caller(0)
	baseDir := filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(currentFile))))
	return filepath.Join(baseDir, "hermit")
}

func TestContextTemplateReplacement(t *testing.T) {
	content := `# Hermit Agent Context

You are **{{AGENT_NAME}}**.
Role: **{{AGENT_ROLE}}**.
Personality: **{{AGENT_PERSONALITY}}**.
`

	agentName := "Hu Tao"
	agentRole := "Funeral Parlor Director"
	agentPersonality := "Cheerful, slightly mischievous, loves poetry"

	result := strings.ReplaceAll(content, "{{AGENT_NAME}}", agentName)
	result = strings.ReplaceAll(result, "{{AGENT_ROLE}}", agentRole)
	result = strings.ReplaceAll(result, "{{AGENT_PERSONALITY}}", agentPersonality)

	if !strings.Contains(result, "Hu Tao") {
		t.Error("expected AGENT_NAME to be replaced with Hu Tao")
	}
	if !strings.Contains(result, "Funeral Parlor Director") {
		t.Error("expected AGENT_ROLE to be replaced")
	}
	if !strings.Contains(result, "Cheerful, slightly mischievous, loves poetry") {
		t.Error("expected AGENT_PERSONALITY to be replaced")
	}
}

func TestContextFileExists(t *testing.T) {
	path := filepath.Join(getProjectRoot(), "context.md")
	_, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("context.md should exist at project root: %v", err)
	}
}

func TestContextFileContainsMessageTagInstructions(t *testing.T) {
	path := filepath.Join(getProjectRoot(), "context.md")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read context.md: %v", err)
	}

	contentStr := string(content)

	if !strings.Contains(contentStr, "<message>") {
		t.Error("context.md should contain <message> tag documentation")
	}
	if !strings.Contains(contentStr, "ALL visible text must be in") {
		t.Error("context.md should explain message tag requirement")
	}
}

func TestContextFileTemplateVariables(t *testing.T) {
	path := filepath.Join(getProjectRoot(), "context.md")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read context.md: %v", err)
	}

	contentStr := string(content)

	if !strings.Contains(contentStr, "{{AGENT_NAME}}") {
		t.Error("context.md should contain {{AGENT_NAME}} template variable")
	}
	if !strings.Contains(contentStr, "{{AGENT_ROLE}}") {
		t.Error("context.md should contain {{AGENT_ROLE}} template variable")
	}
	if !strings.Contains(contentStr, "{{AGENT_PERSONALITY}}") {
		t.Error("context.md should contain {{AGENT_PERSONALITY}} template variable")
	}
}

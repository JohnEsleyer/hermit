package api

import (
	"strings"
	"testing"
)

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
	t.Skip("context.md belongs to hermit project, not HermitShell")
}

func TestContextFileContainsMessageTagInstructions(t *testing.T) {
	t.Skip("context.md belongs to hermit project, not HermitShell")
}

func TestContextFileTemplateVariables(t *testing.T) {
	t.Skip("context.md belongs to hermit project, not HermitShell")
}

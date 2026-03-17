// Package parser provides XML tag parsing for Hermit agent responses.
//
// Documentation:
// - xml-tags.md: Complete reference for all XML tags (<message>, <terminal>, <give>, <app>, etc.)
package parser

import (
	"regexp"
	"strings"
)

type ParsedResponse struct {
	Thought   string          `json:"thought"`
	Message   string          `json:"message"`
	Terminal  string          `json:"terminal"`
	Terminals []string        `json:"terminals,omitempty"`
	System    string          `json:"system,omitempty"`
	Actions   []ParsedAction  `json:"actions"`
	Calendar  *ParsedCalendar `json:"calendar,omitempty"`
	Apps      []ParsedApp     `json:"apps,omitempty"`
}

type ParsedAction struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type ParsedCalendar struct {
	DateTime string `json:"datetime"`
	Prompt   string `json:"prompt"`
}

// ParsedApp represents a parsed <app> tag with HTML, CSS, and JS content.
// Docs: See docs/xml-tags.md for <app> tag format and usage.
type ParsedApp struct {
	Name string `json:"name"`
	HTML string `json:"html"`
	CSS  string `json:"css"`
	JS   string `json:"js"`
}

func activeZone(text string) string {
	idx := strings.LastIndex(strings.ToLower(text), "<end>")
	if idx == -1 {
		return text
	}
	return text[:idx]
}

var (
	thoughtRegex          = regexp.MustCompile(`(?is)<thought>(.*?)</thought>`)
	messageRegex          = regexp.MustCompile(`(?is)<message>(.*?)</message>`)
	terminalRegex         = regexp.MustCompile(`(?is)<terminal>(.*?)</terminal>`)
	systemRegex           = regexp.MustCompile(`(?is)<system>(.*?)</system>`)
	skillRegex            = regexp.MustCompile(`(?is)<skill>(.*?)</skill>`)
	calendarRegex         = regexp.MustCompile(`(?is)<calendar>.*?<prompt>(.*?)</prompt>.*?</calendar>`)
	calendarDateRegex     = regexp.MustCompile(`(?is)<date>(.*?)</date>`)
	calendarTimeRegex     = regexp.MustCompile(`(?is)<time>(.*?)</time>`)
	calendarDateTimeRegex = regexp.MustCompile(`(?is)<datetime>(.*?)</datetime>`)
	// New tags: <give>, <app>
	giveRegex    = regexp.MustCompile(`(?is)<give>(.*?)</give>`)
	appRegex     = regexp.MustCompile(`(?is)<app\s+name=["']?([^"'>]+)["']?>(.*?)</app>`)
	appHTMLRegex = regexp.MustCompile(`(?is)<html>(.*?)</html>`)
	appCSSRegex  = regexp.MustCompile(`(?is)<style>(.*?)</style>`)
	appJSRegex   = regexp.MustCompile(`(?is)<script>(.*?)</script>`)
)

// ParseLLMOutput parses XML tags from LLM response.
// Docs: See docs/xml-tags.md for all supported tags.
// Supported tags: <message>, <terminal>, <give>, <app>, <skill>, <calendar>, <thought>, <system>
func ParseLLMOutput(text string) ParsedResponse {
	text = activeZone(text)
	resp := ParsedResponse{
		Actions:   make([]ParsedAction, 0),
		Terminals: make([]string, 0),
		Apps:      make([]ParsedApp, 0),
	}

	if m := thoughtRegex.FindStringSubmatch(text); len(m) > 1 {
		resp.Thought = strings.TrimSpace(m[1])
	}

	if m := messageRegex.FindStringSubmatch(text); len(m) > 1 {
		resp.Message = strings.TrimSpace(m[1])
	}

	terminalMatches := terminalRegex.FindAllStringSubmatch(text, -1)
	for _, m := range terminalMatches {
		if len(m) > 1 {
			cmd := strings.TrimSpace(m[1])
			if cmd != "" {
				resp.Terminals = append(resp.Terminals, cmd)
			}
		}
	}
	if len(resp.Terminals) > 0 {
		resp.Terminal = resp.Terminals[0]
	}

	if m := systemRegex.FindStringSubmatch(text); len(m) > 1 {
		resp.System = strings.TrimSpace(m[1])
	}

	// Handle <give>filename</give>
	giveMatches := giveRegex.FindAllStringSubmatch(text, -1)
	for _, m := range giveMatches {
		if len(m) > 1 {
			filename := strings.TrimSpace(m[1])
			if filename != "" {
				resp.Actions = append(resp.Actions, ParsedAction{Type: "GIVE", Value: filename})
			}
		}
	}

	// Handle legacy <action type="GIVE">...</action> (backward compatibility)
	actionRegex := regexp.MustCompile(`(?is)<action\s+type=["']?GIVE["']?>(.*?)</action>`)
	actionMatches := actionRegex.FindAllStringSubmatch(text, -1)
	for _, m := range actionMatches {
		if len(m) > 1 {
			filename := strings.TrimSpace(m[1])
			if filename != "" {
				resp.Actions = append(resp.Actions, ParsedAction{Type: "GIVE", Value: filename})
			}
		}
	}

	// Handle <app name="app-name">...</app>
	appMatches := appRegex.FindAllStringSubmatch(text, -1)
	for _, m := range appMatches {
		if len(m) > 2 {
			appName := strings.TrimSpace(m[1])
			appContent := m[2]

			parsedApp := ParsedApp{Name: appName}

			// Extract HTML
			if htmlMatch := appHTMLRegex.FindStringSubmatch(appContent); len(htmlMatch) > 1 {
				parsedApp.HTML = strings.TrimSpace(htmlMatch[1])
			}

			// Extract CSS
			if cssMatch := appCSSRegex.FindStringSubmatch(appContent); len(cssMatch) > 1 {
				parsedApp.CSS = strings.TrimSpace(cssMatch[1])
			}

			// Extract JS
			if jsMatch := appJSRegex.FindStringSubmatch(appContent); len(jsMatch) > 1 {
				parsedApp.JS = strings.TrimSpace(jsMatch[1])
			}

			if parsedApp.HTML != "" || parsedApp.CSS != "" || parsedApp.JS != "" {
				resp.Apps = append(resp.Apps, parsedApp)
			}
		}
	}

	skillMatches := skillRegex.FindAllStringSubmatch(text, -1)
	for _, m := range skillMatches {
		if len(m) > 1 {
			value := strings.TrimSpace(m[1])
			if value != "" {
				resp.Actions = append(resp.Actions, ParsedAction{Type: "SKILL", Value: value})
			}
		}
	}

	if m := calendarRegex.FindStringSubmatch(text); len(m) > 1 {
		prompt := strings.TrimSpace(m[1])
		datetime := ""
		if dt := calendarDateTimeRegex.FindStringSubmatch(text); len(dt) > 1 {
			datetime = strings.TrimSpace(dt[1])
		} else {
			dateVal := ""
			timeVal := ""
			if d := calendarDateRegex.FindStringSubmatch(text); len(d) > 1 {
				dateVal = strings.TrimSpace(d[1])
			}
			if t := calendarTimeRegex.FindStringSubmatch(text); len(t) > 1 {
				timeVal = strings.TrimSpace(t[1])
			}
			datetime = strings.TrimSpace(strings.TrimSpace(dateVal) + " " + strings.TrimSpace(timeVal))
		}
		if prompt != "" {
			resp.Calendar = &ParsedCalendar{DateTime: datetime, Prompt: prompt}
		}
	}

	return resp
}

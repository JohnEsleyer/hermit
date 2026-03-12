package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/hermit/core/internal/db"
	"github.com/hermit/core/internal/docker"
	"github.com/hermit/core/internal/llm"
	"github.com/hermit/core/internal/parser"
	"github.com/hermit/core/internal/telegram"
	"github.com/hermit/core/internal/workspace"
)

type Server struct {
	db     *db.DB
	ws     *workspace.Workspace
	bot    *telegram.Bot
	llm    *llm.Client
	docker *docker.Client
}

func NewServer(database *db.DB, ws *workspace.Workspace, bot *telegram.Bot, llmClient *llm.Client, dockerClient *docker.Client) *Server {
	return &Server{
		db:     database,
		ws:     ws,
		bot:    bot,
		llm:    llmClient,
		docker: dockerClient,
	}
}

type TestRequest struct {
	Payload string `json:"payload"`
	UserID  string `json:"userId"`
}

func (s *Server) HandleXMLContractTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req TestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	parsed := parser.ParseLLMOutput(req.Payload)

	var effects []string
	if parsed.Terminal != "" {
		effects = append(effects, "TERMINAL execution queued: "+parsed.Terminal)
	}

	for _, act := range parsed.Actions {
		if act.Type == "GIVE" {
			effects = append(effects, "FILE DELIVERY queued for: /app/workspace/out/"+act.Value)
		} else if act.Type == "APP" {
			effects = append(effects, "WEB APP published at endpoint: "+act.Value)
		} else {
			effects = append(effects, "UNKNOWN ACTION mapped: "+act.Type+" -> "+act.Value)
		}
	}

	if parsed.Calendar != nil {
		effects = append(effects, "CALENDAR EVENT scheduled for: "+parsed.Calendar.DateTime)
	}

	if len(effects) == 0 {
		effects = append(effects, "No system actions detected. Plain conversational response.")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"raw":           req.Payload,
		"parsed":        parsed,
		"actionEffects": effects,
		"delivered":     true,
	})
}

func (s *Server) HandleAgents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		agents, err := s.db.ListAgents()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(agents)

	case http.MethodPost:
		var agent db.Agent
		if err := json.NewDecoder(r.Body).Decode(&agent); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		id, err := s.db.CreateAgent(&agent)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]int64{"id": id})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) HandleAgentDetail(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	id := strings.TrimPrefix(r.URL.Path, "/api/agents/")
	if id == "" {
		http.Error(w, "Agent ID required", http.StatusBadRequest)
		return
	}

	var idNum int64
	fmt.Sscanf(id, "%d", &idNum)

	switch r.Method {
	case http.MethodGet:
		agent, err := s.db.GetAgent(idNum)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(agent)

	case http.MethodPut:
		var agent db.Agent
		if err := json.NewDecoder(r.Body).Decode(&agent); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		agent.ID = idNum
		if err := s.db.UpdateAgent(&agent); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	case http.MethodDelete:
		if err := s.db.DeleteAgent(idNum); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) HandleSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		key := r.URL.Query().Get("key")
		if key != "" {
			value, err := s.db.GetSetting(key)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(map[string]string{"key": key, "value": value})
			return
		}
		json.NewEncoder(w).Encode(map[string]string{})

	case http.MethodPost:
		var req struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		if err := s.db.SetSetting(req.Key, req.Value); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) HandleWorkspaceOut(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		files, err := s.ws.ListFiles(s.ws.OutDir)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string][]string{"files": files})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

type DockerExecRequest struct {
	Container string `json:"container"`
	Command   string `json:"command"`
}

func (s *Server) HandleDockerExec(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var req DockerExecRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	output, err := s.docker.Exec(req.Container, req.Command)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":   err.Error(),
			"output":  output,
			"success": false,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"output":  output,
		"success": true,
	})
}

func (s *Server) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.bot == nil {
		http.Error(w, "Bot not configured", http.StatusServiceUnavailable)
		return
	}

	var update telegram.Update
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if update.Message != nil && update.Message.Text != "" {
		chatID := fmt.Sprintf("%d", update.Message.Chat.ID)
		s.bot.SendMessage(chatID, "Message received: "+update.Message.Text)
	}

	if update.CallbackQuery != nil {
		s.bot.AnswerCallbackQuery(update.CallbackQuery.ID, "")
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func (s *Server) UploadToWorkspace(userID, filename string, fileData []byte) error {
	inPath := filepath.Join("in", userID)
	if err := s.ws.WriteFile(filepath.Join(inPath, filename), fileData); err != nil {
		return err
	}
	s.db.LogAction(1, userID, "upload", filename)
	return nil
}

func (s *Server) DeliverFile(chatID, filename string) error {
	data, err := s.ws.ReadFile(filepath.Join("out", filename))
	if err != nil {
		return err
	}

	tmpFile, err := os.CreateTemp("", "hermit-deliver-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(data); err != nil {
		return err
	}
	tmpFile.Close()

	if err := s.bot.SendDocument(chatID, tmpFile.Name(), filename); err != nil {
		return err
	}

	s.db.LogAction(1, chatID, "deliver", filename)
	return nil
}

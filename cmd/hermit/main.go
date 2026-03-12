package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/hermit/core/internal/api"
	"github.com/hermit/core/internal/cloudflare"
	"github.com/hermit/core/internal/db"
	"github.com/hermit/core/internal/docker"
	"github.com/hermit/core/internal/llm"
	"github.com/hermit/core/internal/telegram"
)

func main() {
	port := getEnv("PORT", "3000")
	dbPath := getEnv("DATABASE_PATH", "./data/hermit.db")
	telegramToken := getEnv("TELEGRAM_BOT_TOKEN", "")
	llmAPIKey := getEnv("LLM_API_KEY", "")
	llmModel := getEnv("LLM_MODEL", "openai/gpt-4")

	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	database, err := db.NewDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer database.Close()
	log.Printf("Database initialized: %s", dbPath)

	if err := database.InitDefaultUser(); err != nil {
		log.Fatalf("Failed to initialize default user: %v", err)
	}
	log.Printf("Default user initialized: admin (password must be changed on first login)")

	var bot *telegram.Bot
	if telegramToken != "" {
		bot = telegram.NewBot(telegramToken)
		log.Printf("Telegram bot initialized")
	}

	var llmClient *llm.Client
	if llmAPIKey != "" {
		llmClient = llm.NewClient(llm.WithAPIKey(llmAPIKey), llm.WithModel(llmModel))
		log.Printf("LLM client initialized: %s", llmModel)
	}

	dockerClient := docker.NewClient()
	log.Printf("Docker client initialized")

	tunnelManager := cloudflare.NewTunnelManager()

	portInt := 3000
	fmt.Sscanf(port, "%d", &portInt)
	domainMode, _ := database.GetSetting("domain_mode")

	if domainMode != "true" {
		go func() {
			log.Printf("Starting cloudflared tunnel for dashboard...")
			url, err := tunnelManager.StartQuickTunnel("dashboard", portInt)
			if err != nil {
				log.Printf("Failed to start dashboard tunnel: %v", err)
			} else {
				log.Printf("==> Dashboard Public URL: %s", url)
			}
		}()
	}

	apiServer := api.NewServer(database, nil, bot, llmClient, dockerClient, tunnelManager)

	fs := http.FileServer(http.Dir("./dashboard/public"))
	http.Handle("/dashboard/", http.StripPrefix("/dashboard/", fs))
	http.Handle("/", fs)

	http.HandleFunc("/api/auth/login", apiServer.HandleLogin)
	http.HandleFunc("/api/auth/logout", apiServer.HandleLogout)
	http.HandleFunc("/api/auth/change-password", apiServer.HandleChangePassword)
	http.HandleFunc("/api/auth/check", apiServer.HandleCheckAuth)

	http.HandleFunc("/api/agent-tests/xml-contract", apiServer.HandleXMLContractTest)
	http.HandleFunc("/api/agents", apiServer.HandleAgents)
	http.HandleFunc("/api/agents/", apiServer.HandleAgentDetail)
	http.HandleFunc("/api/settings", apiServer.HandleSettings)
	http.HandleFunc("/api/workspace/out", apiServer.HandleWorkspaceOut)
	http.HandleFunc("/api/docker/exec", apiServer.HandleDockerExec)
	http.HandleFunc("/api/docker/containers", apiServer.HandleDockerContainers)
	http.HandleFunc("/api/docker/files", apiServer.HandleDockerFiles)
	http.HandleFunc("/api/docker/download", apiServer.HandleDockerDownload)
	http.HandleFunc("/api/allowlist", apiServer.HandleAllowList)
	http.HandleFunc("/api/allowlist/", apiServer.HandleAllowListDetail)
	http.HandleFunc("/api/calendar", apiServer.HandleCalendar)
	http.HandleFunc("/api/calendar/", apiServer.HandleCalendarDetail)
	http.HandleFunc("/api/tunnels", apiServer.HandleTunnels)
	http.HandleFunc("/api/tunnels/", apiServer.HandleTunnelDetail)
	http.HandleFunc("/api/telegram/verify", apiServer.HandleTelegramVerify)
	http.HandleFunc("/webhook/", apiServer.HandleWebhook)

	log.Printf("Hermit (Go) starting on :%s ...", port)
	log.Printf("Dashboard available at: http://localhost:%s/dashboard/", port)
	log.Printf("Optimized for 1GB VPS. Memory footprint < 15MB.")

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

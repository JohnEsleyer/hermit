.PHONY: all build setup install-deps build-ui build-server build-cli build-docker dev clean test lint run

# Default target - builds everything
all: build

# Setup - builds Docker image and installs dependencies
setup: install-deps build-docker
	@echo "Setup complete! Run 'make run' to start HermitShell."

# Install dependencies like cloudflared
install-deps:
	@echo "Installing dependencies (cloudflared)..."
	@if [ "$$(uname -s)" = "Linux" ]; then \
		wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /tmp/cloudflared && \
		(sudo mv /tmp/cloudflared /usr/local/bin/cloudflared || mv /tmp/cloudflared /usr/local/bin/cloudflared) && \
		chmod +x /usr/local/bin/cloudflared; \
	elif [ "$$(uname -s)" = "Darwin" ]; then \
		(brew install cloudflared || echo "Homebrew not found, please install cloudflared manually."); \
	fi
	@echo "Dependencies installed successfully."

# Build everything (UI + Server + CLI + Docker image)
build: build-ui build-server build-cli build-docker

# Build only the frontend
build-ui:
	@echo "Building frontend..."
	cd dashboard && bun run build
	@echo "Frontend built successfully."

# Build only the Go server
build-server:
	@echo "Building server..."
	go build -o hermit-server ./cmd/hermit/main.go
	@echo "Server built successfully."

# Build CLI
build-cli:
	@echo "Building CLI..."
	go build -o hermitshell ./cmd/cli/main.go
	@echo "CLI built successfully."

# Build Docker image for agents
build-docker:
	@echo "Building Docker image (hermit-agent:latest)..."
	docker build -t hermit-agent:latest .
	@echo "Docker image built successfully."

# Development server (runs Go server)
dev:
	go run ./cmd/hermit/main.go

# Run production server
run: build
	./hermit-server

# Run tests
test:
	go test ./... -v

# Run linter
lint:
	golangci-lint run ./...

# Clean build artifacts
clean:
	rm -f hermit-server hermitshell
	cd dashboard && rm -rf dist
	@echo "Clean complete."

# Help target
help:
	@echo "HermitShell - AI Agent Orchestrator"
	@echo ""
	@echo "Available targets:"
	@echo "  setup          - Build Docker image and install dependencies"
	@echo "  install-deps   - Install mandatory dependencies (cloudflared)"
	@echo "  build          - Build frontend, server, and Docker image"
	@echo "  build-ui       - Build the React dashboard"
	@echo "  build-server   - Build the Go server binary"
	@echo "  build-cli      - Build the CLI binary"
	@echo "  build-docker   - Build the hermit-agent Docker image"
	@echo "  dev            - Run the server in development mode"
	@echo "  run            - Build and run the production server"
	@echo "  test           - Run tests"
	@echo "  lint           - Run linter"
	@echo "  clean          - Remove build artifacts"
	@echo "  help           - Show this help message"

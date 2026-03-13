.PHONY: build-ui build-server release clean dev

build-ui:
	cd dashboard && bun run build

build-server:
	go build -o hermit ./cmd/hermit/main.go

release: build-ui build-server
	@echo "Hermit OS Build Complete"
	@echo "Single binary created: ./hermit"

dev:
	go run ./cmd/hermit/main.go

clean:
	rm -f hermit
	cd dashboard && rm -rf dist

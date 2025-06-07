.PHONY: all build clean install test smartgrep curator monitor

# Build output directory
BUILD_DIR := build
BIN_DIR := $(BUILD_DIR)/bin

# Binary names
SMARTGREP_BIN := $(BIN_DIR)/smartgrep
CURATOR_BIN := $(BIN_DIR)/curator
MONITOR_BIN := $(BIN_DIR)/monitor

# Default target
all: build

# Create directories
$(BIN_DIR):
	mkdir -p $(BIN_DIR)

# Build all binaries
build: $(BIN_DIR) smartgrep curator monitor

# Build individual binaries
smartgrep: $(BIN_DIR)
	go build -o $(SMARTGREP_BIN) ./cmd/smartgrep

curator: $(BIN_DIR)
	go build -o $(CURATOR_BIN) ./cmd/curator

monitor: $(BIN_DIR)
	go build -o $(MONITOR_BIN) ./cmd/monitor

# Install binaries to system
install: build
	@echo "Installing charm TUI binaries..."
	@cp $(SMARTGREP_BIN) /usr/local/bin/smartgrep-tui
	@cp $(CURATOR_BIN) /usr/local/bin/curator-tui
	@cp $(MONITOR_BIN) /usr/local/bin/monitor-tui
	@echo "✅ Installation complete!"
	@echo ""
	@echo "You can now use:"
	@echo "  smartgrep-tui --tui    # Interactive semantic search"
	@echo "  curator-tui --tui      # Interactive AI assistant"
	@echo "  monitor-tui --tui      # Interactive monitoring"

# Run tests
test:
	go test ./...

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)

# Development shortcuts
run-smartgrep: smartgrep
	$(SMARTGREP_BIN) --tui

run-curator: curator
	$(CURATOR_BIN) --tui

run-monitor: monitor
	$(MONITOR_BIN) --tui

# Download dependencies
deps:
	go mod download
	go mod tidy

# Update dependencies
update-deps:
	go get -u ./...
	go mod tidy
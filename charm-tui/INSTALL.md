# Installation Guide for Charm TUIs

## Development Setup

For development, the Go binaries automatically detect and use the TypeScript implementations:

```bash
# Clone the repository
git clone https://github.com/RLabs-Inc/codebase-curator.git
cd codebase-curator/charm-tui

# Install dependencies
make deps

# Build the binaries
make build

# Test locally
./build/bin/smartgrep --help
./build/bin/smartgrep --index
./build/bin/smartgrep "test"
./build/bin/smartgrep --tui
```

## Production Installation

For production environments, you have several options:

### Option 1: Install alongside TypeScript CLIs

```bash
# First install the TypeScript CLIs globally
npm install -g @codebase-curator/smartgrep
npm install -g @codebase-curator/curator
npm install -g @codebase-curator/monitor

# Then install the Go TUI wrappers
cd charm-tui
make build
sudo make install

# Now you have both available:
smartgrep "test"              # TypeScript CLI (via npm)
smartgrep-tui "test"          # Go wrapper with same CLI
smartgrep-tui --tui           # Go TUI mode
```

### Option 2: Replace TypeScript CLIs with Go binaries

```bash
# Build the Go binaries
cd charm-tui
make build

# Install with same names (replaces npm versions)
sudo cp build/bin/smartgrep /usr/local/bin/
sudo cp build/bin/curator /usr/local/bin/
sudo cp build/bin/monitor /usr/local/bin/

# Now the Go binaries handle both modes
smartgrep "test"      # CLI mode (calls TypeScript if available)
smartgrep --tui       # TUI mode
```

### Option 3: Environment-based configuration

Set environment variables to control behavior:

```bash
# Point to custom TypeScript implementations
export SMARTGREP_CLI_PATH=/path/to/smartgrep
export CURATOR_CLI_PATH=/path/to/curator
export MONITOR_CLI_PATH=/path/to/monitor

# Or use the Go binaries standalone
# (they'll work without TypeScript implementations)
```

## How Path Resolution Works

The Go binaries use smart path resolution:

1. **Environment Variables** (highest priority)
   - `SMARTGREP_CLI_PATH`
   - `CURATOR_CLI_PATH`
   - `MONITOR_CLI_PATH`

2. **Development Mode Detection**
   - Checks for TypeScript files relative to binary location
   - Uses `bun run` for `.ts` files

3. **Production Mode** (fallback)
   - Assumes TypeScript CLIs are in PATH
   - Direct execution without `bun`

## Verification

After installation, verify everything works:

```bash
# Check CLI mode
smartgrep --version
smartgrep "test"

# Check TUI mode
smartgrep --tui

# Check development mode (if applicable)
SMARTGREP_CLI_PATH=./src/tools/smartgrep/cli.ts smartgrep "test"
```

## Troubleshooting

### "Module not found" errors
- In development: Ensure you're running from the correct directory
- In production: Install the TypeScript CLIs first

### TUI not launching
- Ensure terminal supports TUI (not all terminals do)
- Try with a different terminal emulator

### Path resolution issues
- Set explicit paths via environment variables
- Check binary location with `which smartgrep`

## Packaging for Distribution

For distributing as standalone binaries:

```bash
# Build with static linking
CGO_ENABLED=0 go build -o smartgrep-standalone ./cmd/smartgrep

# Create release package
tar -czf charm-tui-v1.0.0-darwin-arm64.tar.gz \
  build/bin/smartgrep \
  build/bin/curator \
  build/bin/monitor \
  README.md \
  INSTALL.md
```

This creates self-contained binaries that can be distributed without Go runtime dependencies.
# @codebase-curator/codebase-curator

AI-powered codebase analysis CLI that helps AI assistants understand and work with any codebase. This is the main CLI interface for the Codebase Curator suite.

## Features

- 🤖 **Interactive Chat Mode** - Have conversations about your codebase
- 📊 **Codebase Overview** - Get comprehensive understanding of architecture and patterns
- 🎯 **Feature Guidance** - Detailed help for implementing new features
- 🔧 **Change Planning** - Focused action plans for specific changes
- 💾 **Session Memory** - Maintains context across conversations
- 🚀 **Fast Analysis** - Leverages semantic indexing for instant responses

## Installation

```bash
npm install -g @codebase-curator/codebase-curator
# or
bun add -g @codebase-curator/codebase-curator
```

## Usage

### Get Codebase Overview
```bash
curator overview                  # Analyze current directory
curator overview ./my-project     # Analyze specific project
```

### Ask Questions
```bash
curator ask "How does the authentication system work?"
curator ask ./backend "What are the main API endpoints?"
```

### Plan Features
```bash
curator feature "Add real-time notifications"
curator feature ./app "Implement user profile management" --output detailed
```

### Get Implementation Guidance
```bash
curator change "Fix the memory leak in data processing"
curator change "Refactor the payment service for better error handling"
```

### Interactive Chat Mode
```bash
curator chat                      # Start interactive session
curator chat ./project --new-session
```

### Memory Management
```bash
curator memory                    # Show accumulated knowledge
curator clear                     # Start fresh
```

## Command Reference

### `curator overview [path] [options]`
Get a comprehensive overview of the codebase architecture.

**Options:**
- `-o, --output <format>` - Output format: summary (default), detailed, or json
- `--new-session` - Start fresh without previous context

### `curator ask <question> [path] [options]`
Ask specific questions about the codebase.

**Options:**
- Same as overview

### `curator feature <description> [path] [options]`
Get detailed guidance for implementing a new feature.

**Options:**
- Same as overview

### `curator change <description> [path] [options]`
Get focused action plan for a specific change or fix.

**Options:**
- Same as overview

### `curator chat [path] [options]`
Start an interactive chat session with the curator.

**Options:**
- `--new-session` - Start fresh without previous context
- `-i, --interactive` - Force interactive mode

### `curator memory [path]`
Show what the curator remembers about your codebase.

### `curator clear [path]`
Clear the curator's memory and start fresh.

## How It Works

The Curator CLI uses a unique "Two-Claude" architecture:

1. **You (User)** ask questions about your codebase
2. **Curator Claude** analyzes your code using semantic understanding
3. **Session Persistence** maintains context for follow-up questions

The first overview takes ~2 minutes to build deep understanding. After that, all questions are answered instantly using the persisted session.

## Shell Completions

The CLI includes completions for:
- **Bash**: `source <(curator completion bash)`
- **Zsh**: `source <(curator completion zsh)`
- **Fish**: `curator completion fish | source`

## Examples

### Understanding a New Codebase
```bash
# Get initial overview
curator overview ./new-project

# Ask about specific subsystems
curator ask "How does the payment processing work?"
curator ask "What database patterns are used?"

# Plan your first feature
curator feature "Add user notifications"
```

### Debugging and Fixes
```bash
# Understand the problem area
curator ask "How does the data sync service work?"

# Get fix guidance
curator change "Fix the race condition in data sync"
```

### Architecture Decisions
```bash
# Explore current patterns
curator ask "What authentication method is used?"
curator ask "How is state management handled?"

# Plan architectural changes
curator feature "Migrate from REST to GraphQL"
```

## Integration with Other Tools

Works seamlessly with:
- **@codebase-curator/smartgrep** - For semantic code search
- **@codebase-curator/monitor** - For real-time code monitoring
- **@codebase-curator/semantic-core** - The underlying analysis engine

## Contributing

See the main [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](../../../LICENSE) for details.
# Codebase Curator 🤖📚

An innovative AI-powered codebase analysis system that enables AI assistants to deeply understand and work with any codebase. Built by RLabs Inc. and Claude.

## 🌟 What is Codebase Curator?

Codebase Curator solves a fundamental problem in AI-assisted development: **How can AI write code that truly fits into an existing codebase?**

By analyzing your codebase's patterns, conventions, and architecture, then providing this knowledge through an MCP (Model Context Protocol) server, Codebase Curator enables AI assistants to:

- 🎯 Write code that follows your project's established patterns
- 🏗️ Suggest implementation approaches that fit your architecture
- 🔍 Understand complex relationships between different parts of your code
- 💡 Provide context-aware assistance based on your specific codebase

## 🚀 Features

### 5 Powerful Analysis Algorithms

1. **Import Mapper** - Analyzes dependency graphs and import relationships
2. **Framework Detector** - Identifies frameworks, libraries, and tech stack
3. **File Organization Analyzer** - Understands your project structure patterns
4. **Pattern Aggregator** - Discovers coding patterns and conventions using AST analysis
5. **Code Similarity Analyzer** - Finds similar code blocks and potential duplications

### MCP Server Integration

- **Ask Curator** - Natural language questions about your codebase
- **Run Analysis** - Execute specific analysis algorithms
- **Session Management** - Maintains context across conversations
- **Memory System** - Persists insights for future reference

## 📦 Installation

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Claude CLI](https://claude.ai/code) (for MCP server functionality)
- Node.js (automatically detected)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/RLabsInc/codebase-curator.git
cd codebase-curator

# Install dependencies
bun install

# Run CLI analysis
bun run src/cli.ts <command> <path>

# Start MCP server
bun run src/mcp/server-curator.ts
```

## 🛠️ Usage

### CLI Commands

```bash
# Analyze imports and dependencies
bun run src/cli.ts imports /path/to/project

# Detect frameworks and libraries
bun run src/cli.ts frameworks /path/to/project

# Analyze file organization
bun run src/cli.ts organization /path/to/project

# Discover code patterns
bun run src/cli.ts patterns /path/to/project

# Find similar code
bun run src/cli.ts similarity /path/to/project

# Run all analyses
bun run src/cli.ts all /path/to/project
```

### CLI Options

- `-o, --output <format>` - Output format: `json`, `summary`, or `detailed` (default: summary)
- `-q, --quiet` - Suppress informational output (useful for piping)
- `-e, --exclude <patterns>` - Exclude directories/files matching patterns
- `--curator` - Save results to `.curator/` directory (for MCP integration)

### MCP Server Setup

1. Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "codebase-curator": {
      "command": "bun",
      "args": ["run", "/path/to/codebase-curator/src/mcp/server-curator.ts"],
      "cwd": "/path/to/codebase-curator"
    }
  }
}
```

2. Restart Claude Desktop

3. Use the curator tools:
   - `ask_curator` - Ask questions about any codebase
   - `run_analysis` - Run specific analysis on a project
   - `get_curator_memory` - Retrieve accumulated insights
   - `clear_curator_session` - Start fresh

## ⚙️ Configuration

Create a `.curatorconfig.json` in your project root:

```json
{
  "exclude": [
    "docs",
    "examples",
    "vendor"
  ],
  "include": [
    "test"
  ],
  "analysis": {
    "imports": {
      "includeDevDependencies": true
    },
    "patterns": {
      "minPatternFrequency": 2
    }
  }
}
```

## 🏗️ Architecture

```
codebase-curator/
├── src/
│   ├── algorithms/        # Core analysis algorithms
│   ├── mcp/              # MCP server implementation
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── tests/                # Test files
└── docs/                 # Documentation
```

## 🤝 How It Works

1. **Analysis Phase**: The curator runs sophisticated algorithms to understand your codebase
2. **Knowledge Building**: Insights are stored and accumulated over time
3. **AI Communication**: Through MCP, AI assistants can query the curator
4. **Contextual Responses**: The curator provides specific, actionable guidance

## 🌍 Use Cases

- **Feature Integration**: "How should I add authentication to this project?"
- **Pattern Discovery**: "What naming conventions does this project use?"
- **Architecture Understanding**: "Where should I add this new module?"
- **Code Consistency**: "What error handling pattern should I follow?"

## 📝 Example

```typescript
// Ask the curator about implementing a new feature
const response = await curator.ask(
  "I need to add a payment processing feature. How should I integrate it?"
);

// Response includes:
// - Suggested file locations
// - Existing patterns to follow
// - Integration points
// - Code examples matching your style
```

## 🙏 Acknowledgments

Built with ❤️ by RLabs Inc. and Claude

Special thanks to:
- The Anthropic team for Claude and MCP
- The Bun team for the amazing runtime
- The open-source community

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🤔 Support

- Issues: [GitHub Issues](https://github.com/RLabsInc/codebase-curator/issues)
- Discussions: [GitHub Discussions](https://github.com/RLabsInc/codebase-curator/discussions)

---

**Ready to give your AI assistants deep codebase understanding?** 🚀

Star ⭐ this repo if you find it useful!

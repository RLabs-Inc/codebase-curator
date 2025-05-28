# Codebase Curator 🤖📚

An innovative AI-powered codebase analysis system that enables AI assistants to deeply understand and work with any codebase. Built by RLabs Inc. and Claude.

## 🎉 What's New in v2.3

- **🏗️ Clean Architecture**: Major refactoring to layered service architecture
  - Separation of core business logic from presentation layers
  - Unified MCP server with both curator and direct analysis tools
  - Service-oriented design for better testability and maintenance
- **🐍 Python Support**: Full language analysis for Python projects
  - Import parsing (standard, from, relative, wildcard imports)
  - Framework detection (Django, Flask, FastAPI, pytest, pandas, etc.)
  - Pattern extraction (classes, functions, decorators)
- **🌍 Modular Language System**: Extensible plugin architecture for adding new languages
  - Automatic language detection based on file extensions
  - Common base class for consistent implementation
  - Language-specific customizations preserved

## Previous Updates (v2.2)

- **🚀 Specialized Tools**: Three new MCP tools designed for common development tasks
  - `get_codebase_overview` - No more guessing what a codebase does
  - `add_new_feature` - Stop creating tomorrow's tech debt
  - `implement_change` - Focused fixes without breaking everything
- **⚡ Performance**: Intelligent caching with hierarchical hash trees (3-5x faster)
- **🤝 Claude-to-Claude**: Prompts rewritten for natural AI-to-AI communication
- **🛡️ Stability**: Fixed MaxListenersExceeded warnings and MCP environment compatibility

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

#### Specialized Curator Tools (v2.2+)
- **Get Codebase Overview** - Instant practical overview of any codebase
- **Add New Feature** - Comprehensive guidance for implementing new features
- **Implement Change** - Focused action plans for changes and fixes

#### Core Tools  
- **Ask Curator** - Natural language questions about your codebase
- **Run Analysis** - Execute specific analysis algorithms
- **Get Cache Stats** - Monitor caching performance
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
bun run src/presentation/cli/app.ts <command> <path>

# Start MCP server
bun run src/presentation/mcp/server.ts
```

## 🛠️ Usage

### CLI Commands

```bash
# Analyze imports and dependencies
bun run src/presentation/cli/app.ts imports /path/to/project

# Detect frameworks and libraries
bun run src/presentation/cli/app.ts frameworks /path/to/project

# Analyze file organization
bun run src/presentation/cli/app.ts organization /path/to/project

# Discover code patterns
bun run src/presentation/cli/app.ts patterns /path/to/project

# Find similar code
bun run src/presentation/cli/app.ts similarity /path/to/project

# Run all analyses
bun run src/presentation/cli/app.ts all /path/to/project
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
      "args": ["run", "/path/to/codebase-curator/src/presentation/mcp/server.ts"],
      "cwd": "/path/to/codebase-curator"
    }
  }
}
```

2. Restart Claude Desktop

3. Use the curator tools:
   
   **New Specialized Tools (v2.2+):**
   - `get_codebase_overview` - Get instant practical overview (no params needed!)
   - `add_new_feature` - Get comprehensive feature implementation guidance
   - `implement_change` - Get focused action plans for changes/fixes
   
   **Core Tools:**
   - `ask_curator` - Ask any question about the codebase
   - `run_analysis` - Run specific analysis algorithms
   - `get_curator_memory` - Retrieve accumulated insights
   - `clear_curator_session` - Start fresh
   - `get_cache_stats` - Check caching performance

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

## 🗣️ Language Support

### Currently Supported
- ✅ **TypeScript/JavaScript** - Full support with AST analysis
- ✅ **JSX/TSX** - React and other JSX-based frameworks
- ✅ **Python** - Full support with comprehensive import parsing (v2.3+)
- ✅ **JSON** - Configuration and data files

### Language Features by Type

#### TypeScript/JavaScript
- AST-based import parsing with Bun transpiler
- ES6, CommonJS, and dynamic imports
- Framework detection: React, Vue, Angular, Next.js, Express, etc.
- Full JSX/TSX support

#### Python (NEW in v2.3)
- Import statement parsing (import, from...import, relative imports)
- Framework detection: Django, Flask, FastAPI, pytest, pandas, NumPy, etc.
- Pattern extraction: classes, functions, async functions, decorators
- Handles Python-specific syntax and conventions

### Roadmap
1. **Phase 1: Core Languages** (In Progress)
   - ✅ Python (Completed in v2.3)
   - Go (Next)
   - Rust
   - Java/Kotlin
   - C/C++
   
2. **Phase 2: Extended Language Coverage**
   - Ruby
   - PHP
   - Swift
   - C#/.NET
   - And more based on community needs

3. **Phase 3: Universal Data/Event Flow Analysis**
   - Language-agnostic pattern recognition
   - Cross-language project understanding
   - The ultimate vision from our project_summary.md

## 🏗️ Architecture

```
codebase-curator/
├── src/
│   ├── core/             # Business logic services
│   │   ├── AnalysisService.ts    # Analysis orchestration
│   │   ├── CuratorService.ts     # Main curator logic
│   │   ├── SessionService.ts     # Session management
│   │   └── CuratorProcessService.ts # Claude spawning
│   ├── presentation/     # UI/Interface layers
│   │   ├── cli/          # Command-line interface
│   │   └── mcp/          # MCP server interface
│   ├── algorithms/       # Core analysis algorithms
│   ├── languages/        # Language plugin system
│   ├── services/         # Supporting services
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── tests/               # Test files
└── docs/                # Documentation
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

## 📝 Examples

### Get Instant Overview
```typescript
// No parameters needed - just get the overview!
const overview = await curator.getCodebaseOverview();

// Returns practical info like:
// - What the codebase actually does
// - Where things live
// - Key patterns and conventions
// - Tech debt and gotchas
```

### Add New Feature
```typescript
// Get comprehensive guidance for new features
const guidance = await curator.addNewFeature(
  "Add user notification system with email and in-app alerts"
);

// Returns:
// - Exact file structure to create
// - Integration points with existing code
// - Code examples from THIS codebase
// - Pattern-matching implementation plan
```

### Implement Change
```typescript
// Get focused action plan for changes
const plan = await curator.implementChange(
  "Fix memory leak in WebSocket connection handler"
);

// Returns:
// - What's actually broken (specific lines)
// - Files to modify (just what changes)
// - Before/after code snippets
// - Impact analysis
// - Test updates needed
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

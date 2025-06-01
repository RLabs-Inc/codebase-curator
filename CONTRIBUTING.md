# Contributing to Codebase Curator

First off, thank you for considering contributing to Codebase Curator! It's people like you that help make Claude even better at understanding code.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please be respectful and considerate in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **System information** (OS, Claude Code version, Bun version)
- **Relevant logs** from `~/.codebase-curator/logs/`

### Suggesting Enhancements

Enhancement suggestions are welcome! Please:

- **Check existing issues** first
- **Provide use cases** - explain why this would be useful
- **Be specific** about the implementation if possible
- **Consider compatibility** with Claude Code

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:
- `good first issue` - Simple fixes to get started
- `help wanted` - More involved but guidance available
- `documentation` - Help improve docs

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) (latest version)
- [Claude Code](https://claude.ai/code) for testing
- Git

### Setting Up Your Development Environment

1. **Fork and clone**
```bash
git clone https://github.com/YOUR_USERNAME/codebase-curator.git
cd codebase-curator
```

2. **Install dependencies**
```bash
bun install
```

3. **Run tests**
```bash
bun test
```

4. **Set up MCP development**
```bash
# In your claude_code_config.json, point to your dev version
{
  "mcpServers": {
    "codebase-curator-dev": {
      "command": "bun",
      "args": ["run", "--watch", "/path/to/your/dev/codebase-curator/src/mcp/server.ts"]
    }
  }
}
```

## Project Structure

```
src/
├── core/                  # Core business logic
│   ├── CuratorService.ts      # Main orchestrator
│   ├── CuratorProcessService.ts # Claude CLI management
│   └── CuratorPrompts.ts      # Critical prompts (DO NOT CHANGE)
├── mcp/                   # MCP server implementation
├── cli/                   # CLI interface
└── semantic/              # Smart grep implementation
    └── extractors/        # Language parsers
```

### Key Guidelines

1. **Don't modify prompts** in `CuratorPrompts.ts` without discussion
2. **Maintain backwards compatibility** with Claude Code
3. **Follow existing patterns** - read similar code first
4. **Test with real codebases** before submitting

## Making Changes

### Code Style

We use TypeScript with Bun. Follow these guidelines:

- Use meaningful variable names
- Add types to all functions
- Comment complex logic
- Keep functions focused and small

### Commit Messages

Follow conventional commits:
```
feat: add support for Python semantic indexing
fix: resolve session corruption on Windows
docs: update smart grep examples
test: add coverage for CuratorService
```

### Testing

- Write tests for new features
- Ensure existing tests pass
- Test with various codebase sizes
- Test session persistence

### Documentation

- Update README.md if adding features
- Add JSDoc comments to public APIs
- Update architecture docs for significant changes
- Include examples in documentation

## Pull Request Process

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
- Follow the code style
- Add tests
- Update documentation

3. **Run checks**
```bash
bun test
bun run smartgrep "TODO|FIXME"  # Check for leftover debug code
```

4. **Push and create PR**
- Push to your fork
- Create PR with clear description
- Reference any related issues

5. **PR Review Process**
- Address review comments
- Keep PR focused - one feature/fix per PR
- Be patient - reviews take time

## Adding Language Support

To add a new language to smart grep:

1. **Create extractor** in `src/semantic/extractors/`
```typescript
export class RustExtractor implements LanguageExtractor {
  canHandle(filepath: string): boolean {
    return filepath.endsWith('.rs');
  }
  
  extract(content: string, filepath: string): ExtractionResult {
    // Parse and extract semantic information
  }
}
```

2. **Register extractor** in `SemanticService.ts`

3. **Add tests** for the new language

4. **Update documentation**

## Performance Considerations

When contributing, consider:

- **Memory usage** - Stream large files, don't load entirely
- **Speed** - Use Bun's native APIs when possible
- **Caching** - Reuse expensive computations
- **Timeouts** - Respect dynamic timeout system

## Getting Help

- **Discord**: [Join our community](#)
- **Issues**: Ask questions in GitHub issues
- **Documentation**: Check `/docs` folder

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in relevant documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Remember: Codebase Curator helps Claude understand code better. Your contributions make every Claude user more productive. Thank you for helping! 🙏
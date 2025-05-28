# Contributing to Codebase Curator

First off, thank you for considering contributing to Codebase Curator! 🎉

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in [Issues](https://github.com/RLabsInc/codebase-curator/issues)
- If not, create a new issue with:
  - Clear title and description
  - Steps to reproduce
  - Expected vs actual behavior
  - Your environment (OS, Node version, Bun version)

### Suggesting Enhancements

- Check existing [Issues](https://github.com/RLabsInc/codebase-curator/issues) and [Discussions](https://github.com/RLabsInc/codebase-curator/discussions)
- Create a new discussion for feature proposals
- Explain the use case and benefits

### Pull Requests

1. Fork the repo and create your branch from `main`
2. Run the tests: `bun test`
3. Make sure your code follows the existing style
4. Add tests for new functionality
5. Update documentation as needed
6. Submit your PR!

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/codebase-curator.git
cd codebase-curator

# Install dependencies
bun install

# Run tests
bun test

# Run the CLI
bun run src/presentation/cli/app.ts --help
```

## Code Style

- Use TypeScript
- Follow existing patterns in the codebase
- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and small

## Architecture and Contributions

### Adding Analysis Algorithms

If you're adding a new analysis algorithm:

1. Create the algorithm in `src/algorithms/`
2. Add types in `src/types/`
3. Update `AnalysisService` in `src/core/AnalysisService.ts`
4. Update the CLI presentation layer in `src/presentation/cli/app.ts`
5. Add tests
6. Update documentation

### Adding Language Support

For new language plugins:

1. Create plugin in `src/languages/plugins/{language}/`
2. Extend `BaseLanguageAnalyzer`
3. Register in `src/languages/index.ts`
4. Add comprehensive tests
5. Update documentation

### Service Layer Changes

When modifying core services (`src/core/`):

- Follow the service architecture pattern
- Keep presentation layers thin
- Update both CLI and MCP interfaces if needed
- Ensure proper dependency injection

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Test with different project types if possible

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for helping make Codebase Curator better! 🚀
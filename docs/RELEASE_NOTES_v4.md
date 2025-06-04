# 🚀 Codebase Curator v4.0 Release Notes

## 🎉 Major Language Expansion

We're thrilled to announce Codebase Curator v4.0, featuring **massive language support expansion** from 4 to 10 languages! This release brings comprehensive semantic understanding to more programming languages and configuration file types.

## ✨ What's New

### 🌍 New Language Support

#### Programming Languages Added:
- **Swift** - Full support for iOS/macOS development
  - SwiftUI property wrappers (`@State`, `@Binding`, etc.)
  - Protocol conformance tracking
  - Extension context awareness
  - Interface Builder annotations

- **Shell Scripts** - Bash, Zsh, and more
  - Shebang detection for extensionless scripts
  - Function and alias extraction
  - Variable exports and trap commands
  - Here-doc support

#### Configuration File Types Added:
- **JSON** - Smart configuration parsing
  - Special handling for `package.json` and `tsconfig.json`
  - Hierarchical key extraction
  - JSONC comment support

- **YAML** - Context-aware parsing
  - GitLab CI/GitHub Actions workflow understanding
  - Docker Compose service extraction
  - Kubernetes manifest detection

- **TOML** - Modern config format
  - Cargo.toml and pyproject.toml special handling
  - Table and nested table support

- **Environment Files** - Secure configuration
  - Sensitive value masking
  - Variable categorization (database, auth, API, etc.)
  - Multi-line value support

### 🔧 Bug Fixes

- **Fixed .env exclusion bug** - Previously `.env` files were incorrectly excluded from indexing. Now only `.env/` directories are excluded.
- **Bun compatibility fix** - Resolved crash with `Object.entries().forEach()` in JsonExtractor

### 🛠️ New Tools & Features

- **Git Changes Impact Analysis** - `smartgrep changes` shows which files are affected by uncommitted changes
  - Full cross-reference analysis in ~1 second
  - Risk assessment before committing
  - Compact mode for quick safety checks
- **Custom Concept Groups** - Create project-specific semantic patterns
  - Add groups: `smartgrep group add payments charge,bill,invoice`
  - Persistent storage in `.curatorconfig.json`
  - Full integration with type filters and sorting
- **MCP Tool: `remind_about_task_smartgrep`** - Reminds developers to include explicit smartgrep instructions when using Task agents
- **Comprehensive test files** - Added test files for all new language types
- **Language support documentation** - New guide at `docs/LANGUAGE_SUPPORT.md`

## 📊 By The Numbers

- **Languages**: 4 → 10 (150% increase!)
- **File types supported**: Now includes `.swift`, `.sh`, `.json`, `.yaml`, `.toml`, `.env`
- **Semantic entries indexed**: ~4200+ in typical projects
- **Cross-language search**: Works seamlessly across all languages
- **Performance**: Git impact analysis 37x faster than standalone tools (1s vs 37.5s)
- **Concept Groups**: 20+ built-in groups plus unlimited custom groups

## 🔍 Enhanced Search Capabilities

### Cross-Language Concept Groups
```bash
# Find authentication patterns in ANY language
smartgrep group auth

# Results span:
# - TypeScript: authenticate(), AuthProvider
# - Python: @login_required, auth_user()
# - Swift: AuthenticationService
# - Config: JWT_SECRET, AUTH_URL
```

### Language-Specific Patterns
```bash
# Swift protocols
smartgrep "protocol" --file "*.swift"

# Shell functions
smartgrep "function" --file "*.sh"

# Environment variables
smartgrep "DATABASE" --file ".env*"
```

### Git Impact Analysis
```bash
# Analyze uncommitted changes
smartgrep changes
# Shows: Files changed, symbols modified, and all affected files

# Quick risk assessment
smartgrep changes --compact
# Returns: ✅ Low Risk or ⚠️ Medium Risk based on impact
```

### Custom Concept Groups
```bash
# Add project-specific groups
smartgrep group add payments charge,bill,invoice,transaction
smartgrep group add frontend component,props,state,render

# Search with your groups
smartgrep group payments --type function
smartgrep group frontend --sort usage
```

## 🚀 Performance Improvements

- Incremental indexing handles new file types efficiently
- Parallel extraction for faster initial indexing
- Smart caching preserves semantic understanding between runs

## 📝 Migration Guide

### For Existing Users

1. **Rebuild your semantic index** to include new languages:
   ```bash
   bun run smartgrep index
   ```

2. **Update your CLAUDE.md** if you have language-specific instructions

3. **Check `.curatorconfig.json`** if you have custom exclusions that might affect new file types

### For New Users

Just run the standard setup - all new languages are automatically supported!

## 🙏 Acknowledgments

This release was a collaborative effort between human developers and Claude. Special thanks to the Anthropic team for making such powerful AI-assisted development possible.

## 🔮 What's Next

We're exploring support for:
- Java/Kotlin
- C#/.NET
- Ruby
- PHP
- More configuration formats

## 📦 Installation

```bash
# Via npm (when published)
npm install -g codebase-curator

# Via source
git clone https://github.com/RLabs-Inc/codebase-curator
cd codebase-curator
bun install
```

## 🐛 Known Issues

- Shell script extraction may miss complex heredoc patterns
- YAML anchors and aliases have limited support
- Very large JSON files (>10MB) may need streaming parser improvements

## 📚 Documentation

- [Language Support Guide](./LANGUAGE_SUPPORT.md)
- [Smart Grep Guide](./SMART_GREP_GUIDE.md)
- [Architecture Overview](./ARCHITECTURE.md)

---

Happy coding with your newly multilingual Codebase Curator! 🎉
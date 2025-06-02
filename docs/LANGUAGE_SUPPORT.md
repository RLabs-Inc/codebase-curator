# 🌍 Language Support Guide

Codebase Curator provides deep semantic understanding across **10 languages and file types**, enabling powerful cross-language search and analysis.

## 📚 Supported Languages

### Programming Languages

#### TypeScript/JavaScript
- **Extensions**: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- **Features**:
  - Babel AST parsing for accuracy
  - JSX/TSX component understanding
  - Arrow functions, async/await patterns
  - Class inheritance tracking
  - Import/export analysis
  - Cross-references for function calls and instantiations

#### Python
- **Extensions**: `.py`
- **Features**:
  - Indentation-aware parsing
  - Class method extraction with full paths (e.g., `AuthService.authenticate`)
  - Decorator tracking (`@login_required`, `@property`)
  - Docstring extraction (multi-line)
  - Magic method recognition (`__init__`, `__str__`)
  - Constant detection (ALL_CAPS)

#### Go
- **Extensions**: `.go`
- **Features**:
  - Package-level understanding
  - Interface and struct definitions
  - Method receivers (`func (s *Service) Method()`)
  - Channel operations
  - Embedded types (composition)
  - Import tracking

#### Rust
- **Extensions**: `.rs`
- **Features**:
  - Trait definitions and implementations
  - Macro definitions (`macro_rules!`)
  - Lifetime parameter handling
  - Derive attributes (`#[derive(Debug, Clone)]`)
  - Module structure (`mod`, `pub mod`)
  - Associated types and constants

#### Swift
- **Extensions**: `.swift`
- **Features**:
  - Protocol definitions and conformance
  - Extension tracking
  - SwiftUI property wrappers (`@State`, `@Binding`)
  - Access modifiers (`private`, `public`, `internal`)
  - Computed properties
  - Interface Builder annotations (`@IBOutlet`, `@IBAction`)

#### Shell Scripts
- **Extensions**: `.sh`, `.bash`, `.zsh`, `.fish`, `.bashrc`, `.zshrc`
- **Features**:
  - Shebang detection for files without extensions
  - Function declarations
  - Variable exports
  - Alias definitions
  - Trap commands
  - Here-doc detection
  - Command option parsing (`getopts`)

### Configuration File Types

#### JSON
- **Extensions**: `.json`, `.jsonc`, `.json5`
- **Special Handling**:
  - **package.json**: NPM scripts as functions, dependencies as imports
  - **tsconfig.json**: Compiler options, path mappings
  - **General JSON**: Hierarchical key extraction
- **Features**:
  - JSONC comment removal
  - Nested object traversal
  - Array handling
  - Cross-references for file paths

#### YAML
- **Extensions**: `.yaml`, `.yml`
- **Context-Aware Parsing**:
  - GitLab CI pipelines (`.gitlab-ci.yml`)
  - GitHub Actions workflows
  - Docker Compose services
  - Kubernetes manifests
  - Ansible playbooks
- **Features**:
  - Multi-line string handling
  - Anchor and alias support
  - Indentation-based context

#### TOML
- **Extensions**: `.toml`
- **Special Handling**:
  - **Cargo.toml**: Rust package configuration
  - **pyproject.toml**: Python project configuration
- **Features**:
  - Table and nested table support
  - Array of tables
  - Multi-line strings
  - Inline table extraction

#### Environment Files
- **Extensions**: `.env`, `.env.*` (e.g., `.env.local`, `.env.production`)
- **Features**:
  - Variable categorization (database, auth, API, etc.)
  - Sensitive value masking (passwords, tokens, keys)
  - Comment preservation
  - Multi-line value support
  - Cross-references for ports and URLs

## 🔍 Cross-Language Search Examples

### Concept Groups
Concept groups work across ALL languages:

```bash
# Find ALL authentication patterns in any language
smartgrep group auth

# Results might include:
# - TypeScript: authenticate(), useAuth(), AuthProvider
# - Python: @login_required, authenticate_user()
# - Go: func Authenticate(), type AuthToken
# - Rust: impl Auth for User
# - Config: JWT_SECRET, AUTH_URL, oauth settings
```

### Language-Specific Searches

```bash
# Python decorators
smartgrep "@" --file "*.py"

# Go interfaces
smartgrep "type.*interface" --file "*.go"

# Rust traits
smartgrep "trait" --file "*.rs"

# Swift protocols
smartgrep "protocol" --file "*.swift"

# NPM scripts
smartgrep "scripts" --file "package.json"

# Docker services
smartgrep "services:" --file "docker-compose*.yml"
```

### Cross-Reference Analysis

```bash
# Find all uses of a function across languages
smartgrep refs "authenticate"

# See who imports what
smartgrep refs "AuthService"

# Track configuration usage
smartgrep refs "DATABASE_URL"
```

## 🛠️ Implementation Details

### Language Extractor Interface

All language extractors implement this interface:

```typescript
interface LanguageExtractor {
  canHandle(filePath: string): boolean
  extract(content: string, filePath: string): ExtractionResult
}

interface ExtractionResult {
  definitions: SemanticInfo[]
  references: CrossReference[]
}
```

### Adding a New Language

To add support for a new language:

1. Create a new extractor in `src/packages/semantic-core/src/extractors/`
2. Implement the `LanguageExtractor` interface
3. Add it to `SemanticService.ts` extractors array
4. Export it from `src/packages/semantic-core/src/index.ts`

### Performance Optimizations

- **Incremental Indexing**: Only changed files are re-processed
- **Streaming Parsers**: Large files are processed in chunks
- **Parallel Extraction**: Multiple files processed concurrently
- **Smart Caching**: Semantic index persisted between runs

## 📊 Language Feature Matrix

| Language | Functions | Classes | Variables | Imports | Comments | Cross-Refs |
|----------|-----------|---------|-----------|---------|----------|------------|
| TypeScript/JS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Python | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Go | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rust | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Swift | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shell | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| JSON | ❌ | ❌ | ✅ | ✅* | ❌ | ✅ |
| YAML | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| TOML | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| .env | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |

*JSON imports are dependencies in package.json

## 💡 Tips & Tricks

1. **Use type filters** for precise searches:
   ```bash
   smartgrep "process" --type function --file "*.py"
   ```

2. **Combine patterns** for complex searches:
   ```bash
   smartgrep "async&test" --type function  # Async test functions
   ```

3. **Leverage concept groups** for broad searches:
   ```bash
   smartgrep group error --max 20  # All error handling patterns
   ```

4. **Check cross-references** before refactoring:
   ```bash
   smartgrep refs "OldClassName"  # See all usages before renaming
   ```

## 🚀 Future Language Support

We're considering adding support for:
- Java/Kotlin
- C#/.NET
- Ruby
- PHP
- C/C++
- Elixir
- Clojure

Have a language request? Open an issue!
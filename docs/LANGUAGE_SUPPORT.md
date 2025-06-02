# Language Support Guide

## Overview

Codebase Curator now supports semantic analysis across multiple programming languages. Each language extractor understands the unique syntax and patterns of its target language.

## Supported Languages

### TypeScript/JavaScript
- **File Extensions**: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- **Features Extracted**:
  - Functions (regular, arrow, async)
  - Classes and methods
  - Variables and constants
  - Imports and exports
  - Interfaces and type aliases
  - JSX components
  - Comments and JSDoc
- **Cross-References**: Function calls, class instantiation, inheritance

### Python
- **File Extensions**: `.py`
- **Features Extracted**:
  - Functions and async functions
  - Classes and methods (including `__init__`, `__str__`, etc.)
  - Module-level variables and constants
  - Import statements (from/import)
  - Decorators
  - Docstrings (module, class, function)
  - Type hints
- **Cross-References**: Function calls, class instantiation, inheritance, decorator usage

### Go
- **File Extensions**: `.go`
- **Features Extracted**:
  - Package declarations
  - Functions and methods
  - Types (structs, interfaces)
  - Constants and variables
  - Import statements
  - Struct fields
  - Channel operations
  - Comments and documentation
- **Cross-References**: Function calls, type instantiation, interface implementation, embedding

### Rust
- **File Extensions**: `.rs`
- **Features Extracted**:
  - Functions and methods
  - Structs and enums
  - Traits and implementations
  - Type aliases
  - Constants and statics
  - Modules
  - Use statements
  - Macros (definitions and usage)
  - Doc comments
- **Cross-References**: Function calls, type instantiation, trait implementation, derive attributes

## Language-Specific Features

### Python Specifics
```python
# Extracts class with inheritance
class AuthService(BaseService):  # Cross-ref: extends BaseService
    """Authentication service"""  # Extracted as doc comment
    
    def __init__(self):          # Extracted as AuthService.__init__
        super().__init__()        # Cross-ref: call to super
    
    @login_required              # Cross-ref: decorator usage
    async def authenticate(self, user: User) -> bool:  # With type hints
        pass
```

### Go Specifics
```go
// Package level extraction
package auth

// Interface extraction
type Authenticator interface {
    Authenticate(user *User) error
}

// Struct with embedded type
type AuthService struct {
    BaseService  // Cross-ref: extends BaseService
    db *Database
}

// Method extraction
func (s *AuthService) Authenticate(user *User) error {
    // Implementation
}
```

### Rust Specifics
```rust
// Trait definition
pub trait Authenticate {
    fn authenticate(&self, user: &User) -> Result<bool, Error>;
}

// Implementation with derives
#[derive(Debug, Clone)]  // Cross-refs: Debug, Clone
pub struct AuthService {
    db: Arc<Database>,
}

// Trait implementation
impl Authenticate for AuthService {  // Cross-ref: implements Authenticate
    fn authenticate(&self, user: &User) -> Result<bool, Error> {
        // Implementation
    }
}
```

## Smart Grep Examples

### Cross-Language Searches
```bash
# Find all authentication functions across languages
smartgrep "auth" --type function

# Results might include:
# TypeScript: authenticate(), validateAuth()
# Python: def authenticate(), def check_auth()
# Go: func Authenticate(), func NewAuthService()
# Rust: fn authenticate(), fn verify_auth()
```

### Language-Specific Patterns
```bash
# Python decorators
smartgrep "@" --file "*.py"

# Go interfaces
smartgrep "interface" --file "*.go"

# Rust traits
smartgrep "trait" --file "*.rs"

# TypeScript types
smartgrep "interface" --file "*.ts"
```

## Concept Groups

Concept groups work across all languages:

```bash
smartgrep group auth
# Searches for: auth, authenticate, login, signin, credential, token, etc.
# Across ALL supported languages
```

## Adding New Languages

To add support for a new language:

1. Create a new extractor in `src/packages/semantic-core/src/extractors/`
2. Implement the `LanguageExtractor` interface
3. Register it in `SemanticService.ts`
4. Export it from `index.ts`

Example structure:
```typescript
export class NewLanguageExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.ext$/.test(filePath)
  }

  extract(content: string, filePath: string): ExtractResult {
    // Parse and extract semantic information
  }
}
```

## Performance Notes

- Each extractor uses language-appropriate parsing strategies
- TypeScript uses Babel for accurate AST parsing
- Python, Go, and Rust use pattern-based extraction
- All extractors include fallback mechanisms for edge cases
- Incremental indexing only reprocesses changed files

## Best Practices

1. **Use Type Filters**: Narrow searches by declaration type
   ```bash
   smartgrep "process" --type function
   ```

2. **Combine with File Filters**: Search specific languages
   ```bash
   smartgrep "async" --file "*.py"
   ```

3. **Leverage Cross-References**: Find usage patterns
   ```bash
   smartgrep refs "DatabaseConnection"
   ```

4. **Use Concept Groups**: For semantic searches
   ```bash
   smartgrep group database
   ```
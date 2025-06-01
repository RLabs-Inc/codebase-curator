# Smart Grep Tool - Semantic Indexing for Codebase Understanding

## Core Concept
A language-agnostic semantic search tool that indexes meaningful human-readable information from codebases and provides intelligent, contextual search capabilities.

## Why This Is Revolutionary
- **Universal**: Works across all programming languages and codebases
- **Semantic**: Finds concepts, not just string matches
- **Contextual**: Shows where and how terms are used
- **Intelligent**: Groups related terms and provides rich context

## What Gets Indexed

### 1. Code Identifiers
- **Function names**: `authenticateUser`, `processPayment`, `validateEmail`
- **Class names**: `UserService`, `PaymentProcessor`, `AuthenticationError`
- **Variable names**: `userPassword`, `apiEndpoint`, `configData`
- **Constants**: `MAX_RETRY_ATTEMPTS`, `API_BASE_URL`, `AUTH_TOKEN`
- **File names**: `auth-service.ts`, `payment-utils.js`, `user-model.py`

### 2. String Literals (The Gold Mine)
- **Error messages**: `"Invalid email format"`, `"Payment failed"`
- **User messages**: `"Profile updated successfully"`, `"Welcome back"`
- **API endpoints**: `"/api/auth/login"`, `"/users/:id/profile"`
- **Configuration values**: `"production"`, `"redis://localhost"`
- **Log messages**: `"User authentication successful"`

### 3. Comments
- **TODO comments**: `// TODO: refactor authentication logic`
- **Explanatory comments**: `// Handle Stripe webhook for payments`
- **Documentation comments**: `/** Validates user credentials */`

## Index Structure

Each indexed entry contains:
```json
{
  "term": "authenticateUser",
  "type": "function",
  "file": "auth/service.ts",
  "line": 34,
  "column": 16,
  "context": "export function authenticateUser(email: string, password: string)",
  "surrounding_lines": [
    "// Validates user credentials against database",
    "export function authenticateUser(email: string, password: string) {",
    "  const user = await User.findByEmail(email);"
  ],
  "related_terms": ["email", "password", "User", "findByEmail"],
  "language": "typescript"
}
```

## Smart Search Features

### 1. Individual Term Search
```bash
smartgrep "payment"
# Returns all payment-related functions, classes, variables, strings, comments
```

### 2. Predefined Concept Groups
```bash
smartgrep "auth"  # Searches: ["auth", "authenticate", "login", "signin", "credential", "token"]
smartgrep "database"  # Searches: ["db", "database", "query", "sql", "mongo", "redis"]
smartgrep "api"  # Searches: ["api", "endpoint", "route", "request", "response"]
smartgrep "error"  # Searches: ["error", "exception", "fail", "invalid", "warning"]
```

### 3. Contextual Filtering
```bash
smartgrep "user" --type=function  # Only functions
smartgrep "auth" --type=string    # Only string literals
smartgrep "payment" --context=error  # Only error-related contexts
```

## Result Presentation

```
Search: "auth" (found 15 results across 8 files)

📁 FUNCTIONS (4)
├── authenticateUser        → auth/service.ts:34
├── validateAuthToken       → auth/middleware.ts:12
├── refreshAuth            → auth/utils.ts:67
└── logAuthAttempt         → logging/auth.ts:23

📦 CLASSES (2)
├── AuthenticationService  → auth/service.ts:8
└── AuthError             → auth/errors.ts:15

🔤 CONSTANTS (3)
├── AUTH_TOKEN_EXPIRY      → config/auth.ts:5
├── MAX_AUTH_ATTEMPTS      → config/security.ts:12
└── AUTH_COOKIE_NAME       → config/cookies.ts:7

💬 STRINGS (4)
├── "Please log in to continue"     → auth/middleware.ts:45
├── "/api/auth/login"              → routes/auth.ts:23
├── "Invalid authentication token"  → auth/errors.ts:32
└── "Authentication successful"     → auth/service.ts:89

📝 COMMENTS (2)
├── "// Handle OAuth authentication flow"  → auth/oauth.ts:15
└── "// TODO: implement 2FA auth"         → auth/service.ts:156
```

## Implementation Architecture

### 1. Language Parser Integration
```typescript
interface LanguageParser {
  canParse(filePath: string): boolean;
  extractSemanticInfo(content: string, filePath: string): SemanticInfo[];
}

// Implementations:
- TypeScriptParser (uses Babel/TypeScript compiler)
- PythonParser (uses Python AST)
- GoParser (uses go/parser)
- JavaParser (uses ANTLR or similar)
- RustParser (uses syn)
```

### 2. Information Extractor
```typescript
interface SemanticInfo {
  term: string;
  type: 'function' | 'class' | 'variable' | 'constant' | 'string' | 'comment';
  location: { file: string; line: number; column: number };
  context: string;
  surroundingLines: string[];
  relatedTerms: string[];
}
```

### 3. Index Storage
```typescript
interface SearchIndex {
  addEntry(info: SemanticInfo): void;
  search(query: string, options?: SearchOptions): SearchResult[];
  searchGroup(group: ConceptGroup): SearchResult[];
}
```

### 4. Integration with Existing System
- Use the existing `CodebaseStreamerBun` for efficient file processing
- Add semantic extraction to the streaming pipeline
- Store index alongside other codebase analysis data

## Predefined Concept Groups

```typescript
const CONCEPT_GROUPS = {
  auth: ["auth", "authenticate", "login", "signin", "credential", "token", "oauth", "jwt"],
  database: ["db", "database", "query", "sql", "mongo", "redis", "orm", "migration"],
  api: ["api", "endpoint", "route", "request", "response", "controller", "handler"],
  error: ["error", "exception", "fail", "invalid", "warning", "catch", "throw"],
  user: ["user", "account", "profile", "member", "customer", "person"],
  payment: ["payment", "billing", "charge", "invoice", "transaction", "stripe", "paypal"],
  config: ["config", "setting", "environment", "env", "constant", "variable"],
  test: ["test", "spec", "mock", "fixture", "assert", "expect", "describe"]
};
```

## CLI Interface

```bash
# Basic search
smartgrep "authentication"

# Group search
smartgrep --group auth

# Filtered search
smartgrep "user" --type function --file "*.service.*"

# Context search
smartgrep "error" --context validation

# Export results
smartgrep "api" --output json > api-analysis.json
```

## Benefits for Curator Claude

1. **Instant semantic entry points**: Instead of guessing what to grep for
2. **Contextual understanding**: See how terms are actually used
3. **Pattern discovery**: Find similar implementations quickly
4. **Cross-language consistency**: Same interface across all codebases
5. **Rich context**: Understand surrounding code without reading files

## Benefits for Human Developers

1. **Rapid codebase exploration**: Understand new codebases quickly
2. **Refactoring assistance**: Find all usages of concepts across languages
3. **Code review efficiency**: Quickly understand change impacts
4. **Documentation aid**: Generate glossaries of codebase concepts

## Implementation Complexity Assessment

**LOW TO MEDIUM COMPLEXITY** because:
- ✅ Existing parsers handle the hard work
- ✅ File streaming system already exists
- ✅ Index structure is straightforward
- ✅ No AI/ML complexity required
- ✅ Can start with 2-3 languages and expand

**Main challenges**:
- Parser integration and maintenance
- Index performance for large codebases
- Graceful handling of parsing failures
- Cross-language concept normalization

## Next Steps

1. **Proof of Concept**: Build for TypeScript/JavaScript first
2. **Core Index**: Implement basic indexing and search
3. **CLI Interface**: Build the smartgrep command
4. **Expansion**: Add Python, Go, etc.
5. **Integration**: Connect with existing Curator system

## Success Metrics

- **Time to understand**: How quickly can Curator Claude answer "how does auth work?"
- **Search precision**: How often does search return useful results?
- **Coverage**: What percentage of semantic information is captured?
- **Adoption**: How often does Curator Claude choose this tool over grep?

---

**This tool could fundamentally change how AI explores and understands codebases by providing semantic entry points instead of syntactic searching.**
# Smart Grep Tool - Semantic Indexing with Cross-Reference Tracking

## Core Concept
A language-agnostic semantic search tool that indexes meaningful human-readable information from codebases, tracks cross-references between code elements, and provides intelligent, contextual search capabilities with usage analysis.

## Why This Is Revolutionary
- **Universal**: Works across all programming languages and codebases
- **Semantic**: Finds concepts, not just string matches
- **Contextual**: Shows where and how terms are used
- **Intelligent**: Groups related terms and provides rich context
- **Cross-Referenced**: Tracks function calls, class usage, and dependencies
- **Impact Analysis**: Shows what would be affected by changes

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

### 4. Cross-References (NEW!)
- **Function calls**: `authenticateUser()` → tracks where it's called
- **Class instantiations**: `new CuratorService()` → tracks usage
- **Inheritance**: `class AuthService extends BaseService` → tracks hierarchy
- **Imports**: `import { User } from './models'` → tracks dependencies

## Index Structure

### Semantic Information Entry
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

### Cross-Reference Entry (NEW!)
```json
{
  "targetTerm": "authenticateUser",
  "referenceType": "call",
  "fromLocation": {
    "file": "routes/auth.ts",
    "line": 25,
    "column": 12
  },
  "context": "const user = await authenticateUser(email, password);"
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

## Predefined Concept Groups (Extended!)

```typescript
const CONCEPT_GROUPS = {
  // Original groups
  auth: ["auth", "authenticate", "login", "signin", "credential", "token", "oauth", "jwt"],
  database: ["db", "database", "query", "sql", "mongo", "redis", "orm", "migration"],
  api: ["api", "endpoint", "route", "request", "response", "controller", "handler"],
  error: ["error", "exception", "fail", "invalid", "warning", "catch", "throw"],
  
  // NEW architectural groups
  service: ["service", "provider", "manager", "orchestrator", "handler", "processor"],
  flow: ["flow", "stream", "pipeline", "process", "workflow", "sequence", "chain"],
  architecture: ["architecture", "pattern", "structure", "design", "layer", "module"],
  
  // NEW code organization groups
  import: ["import", "export", "require", "module", "dependency", "package"],
  interface: ["interface", "type", "contract", "protocol", "schema", "definition"],
  
  // ... and many more!
};
```

## CLI Interface (Fully Enhanced!)

### Search Patterns
```bash
# Basic search with usage counts
smartgrep "authenticateUser"  # Shows: authenticateUser (12 uses)

# OR pattern - find any of these
smartgrep "addCrossReference|getReferences|getImpactAnalysis"

# AND pattern - must contain all
smartgrep "error&handler&async"

# NOT pattern - exclude results
smartgrep "!test" --type function

# Regex pattern
smartgrep "/add.*Reference/" --regex

# Exact match
smartgrep "CuratorService" --exact
```

### Advanced Options
```bash
# Type filtering (supports multiple)
smartgrep "process" --type function,class

# File filtering
smartgrep "auth" --file "*.service.*,*.controller.*"

# Sorting options
smartgrep "service" --sort usage      # By usage count
smartgrep "error" --sort name         # Alphabetically

# Output formats
smartgrep "auth" --json              # JSON output
smartgrep "api" --compact            # One line per result
smartgrep "user" --no-context        # Hide surrounding code

# Cross-reference analysis
smartgrep refs "CuratorService"      # Full impact analysis

# Concept groups
smartgrep auth                        # Pre-defined semantic groups
smartgrep --groups                    # Show all groups
```

### Enhanced Output Examples

#### Full Context Display
```
📁 FUNCTION (1)
├── authenticateUser (12 uses)     → auth/service.ts:34:16
│   export async function authenticateUser(email: string, password: string): Promise<User>
│   ┌─ Context:
│   │ // Validates user credentials against database
│   │ export async function authenticateUser(email: string, password: string): Promise<User> {
│   │   const user = await User.findByEmail(email);
│   📎 Related: User, findByEmail, validatePassword, createToken
│   
│   📍 Used 12 times:
│   1. routes/auth.ts:25 (call)
│      const user = await authenticateUser(req.body.email, req.body.password);
│   2. middleware/auth.ts:15 (call)
│      const authenticated = await authenticateUser(email, password);
│   3. tests/auth.test.ts:45 (call)
│      expect(await authenticateUser('test@example.com', 'password')).toBeTruthy();
│      ... and 9 more
```

#### String with Context
```
💬 STRING (1)
├── "Invalid credentials provided" → auth/errors.ts:23:15
│   "Invalid credentials provided"
│   In: throw new AuthError("Invalid credentials provided", 401);
```

#### Cross-Reference Analysis
```
smartgrep refs "CuratorService"

🔍 References for "CuratorService"
📊 Found 7 references in 3 files

📈 By Type:
   import: 2
   instantiation: 3
   call: 2

📁 mcp/server.ts
   Line 14: import → import { CuratorService } from '../core/CuratorService';
   Line 25: instantiation → const curator = new CuratorService(config);
   Line 47: call → await curator.analyzeCodebase(projectPath);
```

## Data We Collect and Display

For every search result, smart grep shows:

1. **Term with usage count**: `authenticateUser (12 uses)`
2. **Exact location**: `auth/service.ts:34:16` (file:line:column)
3. **Full code context**: The complete line/signature
4. **Surrounding lines**: 2-3 lines before/after
5. **Related terms**: Other identifiers found nearby
6. **Cross-references**: Where it's called with actual code
7. **Type-specific formatting**: Signatures for functions, context for strings

## Benefits for Curator Claude

1. **One search, complete picture**: No need for multiple grep calls
2. **Semantic understanding**: Finds concepts, not just text matches
3. **Impact analysis**: Instantly see what uses what
4. **Rich context**: Understand code without opening files
5. **Advanced patterns**: OR, AND, NOT, regex in one tool
6. **No more fallback to grep**: Everything semantic is indexed

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
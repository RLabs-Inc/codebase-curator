# 🔍 Smart Grep - Semantic Code Search

Smart Grep is not just another search tool - it understands code structure and provides semantic insights about your codebase.

## What Makes It Smart?

Traditional grep searches text. Smart Grep understands:
- **Code Structure**: Functions, classes, variables, imports
- **Usage Patterns**: How many times something is used
- **Cross-References**: Where things are called from
- **Context**: Surrounding code that matters

## Installation

```bash
# After installing Codebase Curator
cd codebase-curator
bun link

# Now available globally
smartgrep --help
```

## Basic Usage

### Simple Search
```bash
smartgrep "user"
```
Returns all user-related code organized by type:
- Functions with "user" 
- Classes with "user"
- Variables with "user"
- Comments mentioning "user"

### Advanced Search Patterns

#### OR Search (|)
```bash
smartgrep "login|auth|signin"
```
Finds any of these terms.

#### AND Search (&)
```bash
smartgrep "async&function"
```
Finds async functions only.

#### NOT Search (!)
```bash
smartgrep "!test" --type function
```
Find all functions except tests.

#### Regex Search
```bash
smartgrep "/user.*Service/" --regex
```
Full regex pattern matching.

#### Exact Match
```bash
smartgrep "UserService" --exact
```
Case-sensitive exact matches only.

## Filtering Options

### By Type
```bash
# Single type
smartgrep "database" --type function

# Multiple types
smartgrep "api" --type function,class

# Available types:
# function, class, variable, interface, 
# type, import, comment, string
```

### By File Pattern
```bash
# Search only in service files
smartgrep "error" --file "*.service.ts"

# Search in specific directory
smartgrep "config" --file "src/core/*"
```

### By Usage Count
```bash
# Sort by most used
smartgrep "function" --sort usage

# Find unused code
smartgrep "function" --sort usage | grep "(0 uses)"
```

## Cross-References

Find where something is used:
```bash
smartgrep refs "PaymentService"
```

Shows every location that references PaymentService:
```
📎 Cross-references for "PaymentService":
├── Used in handlePayment() → controllers/checkout.ts:45
├── Imported by OrderService → services/order.ts:3
├── Instantiated in main() → index.ts:23
└── Tested in payment.test.ts → tests/payment.test.ts:12
```

## Output Formats

### Detailed (Default)
```bash
smartgrep "authenticate"
```
Shows full context, signatures, and usage counts.

### Compact
```bash
smartgrep "authenticate" --compact
```
One line per result for scanning.

### No Context
```bash
smartgrep "authenticate" --no-context
```
Just the matches without surrounding code.

### Max Results
```bash
smartgrep "user" --max 10
```
Limit number of results.

## Concept Groups

Smart Grep understands common programming concepts:

```bash
# Authentication patterns
smartgrep auth

# Error handling
smartgrep error

# Database operations
smartgrep database

# API endpoints
smartgrep api

# State management
smartgrep state

# View all concept groups
smartgrep --groups
```

## Real-World Examples

### 1. Understanding a New Codebase
```bash
# Find main entry points
smartgrep "main|init|start" --type function

# Understand the architecture
smartgrep "service|controller|model" --type class

# Find configuration
smartgrep "config|settings|env"
```

### 2. Adding a Feature
```bash
# Find similar features
smartgrep "user|profile" --type class,function

# Understand the patterns
smartgrep refs "UserService"

# Find where to add code
smartgrep "router|route|endpoint"
```

### 3. Debugging
```bash
# Find error handling
smartgrep "catch|error|exception"

# Trace function calls
smartgrep refs "problematicFunction"

# Find logging
smartgrep "console|log|debug"
```

### 4. Refactoring
```bash
# Find duplicated patterns
smartgrep "getData" --type function

# Find unused exports
smartgrep "export" --sort usage | grep "(0 uses)"

# Find long functions
smartgrep "function" --sort length
```

## Performance Tips

1. **Use specific types**: `--type function` is faster than searching everything
2. **Use file patterns**: `--file "*.service.*"` narrows the search
3. **Combine filters**: Multiple filters work together for precision
4. **Use concept groups**: Predefined groups are optimized

## Integration with Curator Claude

When Curator Claude analyzes your codebase, it uses smart grep extensively:

```typescript
// In prompts
"bun run smartgrep service"
"bun run smartgrep error --type function"
"bun run smartgrep refs 'MainComponent'"
```

This is how it quickly understands your patterns and architecture.

## Troubleshooting

### "No semantic index found"
Run in your project root or build the index:
```bash
cd your-project
smartgrep --build
```

### Results seem outdated
The index auto-updates, but you can force rebuild:
```bash
smartgrep --rebuild
```

### Too many results
Use filters to narrow down:
```bash
smartgrep "user" --type function --file "src/*" --max 20
```

## Advanced Features

### Custom Extractors
Add support for new languages by creating extractors in:
`src/semantic/extractors/`

### Concept Group Customization
Define project-specific concepts in:
`.curatorconfig.json`

### Performance Tuning
Adjust indexing settings:
```json
{
  "semantic": {
    "maxFileSize": "500KB",
    "excludePatterns": ["*.min.js"],
    "incrementalIndex": true
  }
}
```

## Why Use Smart Grep?

- **Faster Understanding**: See code organization instantly
- **Better Navigation**: Jump to the right place immediately  
- **Smarter Refactoring**: Know what depends on what
- **Effective Debugging**: Trace issues through the codebase
- **Code Quality**: Find unused code and duplications

Smart Grep is your semantic lens into the codebase - use it to see not just text, but meaning.
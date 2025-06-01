# Smart Grep Tool - Language Expansion Guide (with Cross-References!)

> **Goal**: Add support for new programming languages with full cross-reference tracking. Each language addition should extract both definitions AND usages, following the same proven pattern.

## The Simple 5-Step Process 🎯

### Step 1: Choose Your Parser
### Step 2: Create Language Extractor  
### Step 3: Test with Sample Code
### Step 4: Register the Extractor
### Step 5: Add Language-Specific Concepts (Optional)

---

## Step 1: Choose Your Parser 📚

**For each language, use the most mature, widely-adopted parser:**

### JavaScript/TypeScript ✅ (Already Done)
- **Parser**: `@babel/parser`
- **Why**: Industry standard, handles all JS/TS variants
- **Installation**: `bun add @babel/parser @babel/traverse`

### Python 🐍
- **Parser**: Built-in `ast` module (via Python subprocess) OR `py-ast` npm package
- **Why**: Official Python AST, most accurate
- **Installation**: `bun add python-ast-tools` (if using npm wrapper)

### Go 🐹
- **Parser**: Tree-sitter with Go grammar OR native go/parser via subprocess
- **Why**: Official Go tooling is excellent
- **Installation**: `bun add tree-sitter tree-sitter-go`

### Rust 🦀
- **Parser**: Tree-sitter with Rust grammar
- **Why**: Rust's syn crate is excellent but requires Rust runtime
- **Installation**: `bun add tree-sitter tree-sitter-rust`

### Java ☕
- **Parser**: Tree-sitter with Java grammar OR ANTLR Java parser
- **Why**: Mature, handles all Java versions
- **Installation**: `bun add tree-sitter tree-sitter-java`

### C/C++ ⚡
- **Parser**: Tree-sitter with C/C++ grammar
- **Why**: Handles preprocessor directives better than alternatives
- **Installation**: `bun add tree-sitter tree-sitter-c tree-sitter-cpp`

**Rule of Thumb**: Use Tree-sitter for languages without good JavaScript-compatible parsers. Use native parsers when available and stable.

---

## Step 2: Create Language Extractor 🔧

**Copy the TypeScript extractor and adapt it. Here's a Python example:**

### Create `src/semantic/extractors/PythonExtractor.ts`:

```typescript
import { LanguageExtractor, SemanticInfo } from '../types';
// Import your chosen parser here
import * as pythonParser from 'python-ast-tools'; // Example

export class PythonExtractor implements LanguageExtractor {
  canHandle(filePath: string): boolean {
    return /\.py$/.test(filePath);
  }

  extract(content: string, filePath: string): { definitions: SemanticInfo[]; references: CrossReference[] } {
    const definitions: SemanticInfo[] = [];
    const references: CrossReference[] = []; // NEW!
    const lines = content.split('\n');

    try {
      // Parse with your chosen parser
      const ast = pythonParser.parse(content);

      // Walk the AST and extract information
      this.walkAst(ast, (node, location) => {
        // DEFINITIONS
        if (node.type === 'FunctionDef') {
          definitions.push(this.createSemanticInfo(
            node.name,
            'function',
            location,
            filePath,
            lines,
            this.getContext(location, lines)
          ));
        }
        
        if (node.type === 'ClassDef') {
          definitions.push(this.createSemanticInfo(
            node.name,
            'class',
            location,
            filePath,
            lines,
            this.getContext(location, lines)
          ));
          
          // NEW! Track inheritance
          if (node.bases) {
            node.bases.forEach((base: any) => {
              if (base.type === 'Name') {
                references.push({
                  targetTerm: base.id,
                  referenceType: 'extends',
                  fromLocation: {
                    file: filePath,
                    line: location.line || 0,
                    column: location.column || 0,
                  },
                  context: this.getContext(location, lines),
                });
              }
            });
          }
        }

        if (node.type === 'Assign') {
          // Handle variable assignments
          // Extract variable names and values
        }

        if (node.type === 'Str' || node.type === 'Constant') {
          // Handle string literals
          const value = node.value || node.s;
          if (this.isMeaningfulString(value)) {
            definitions.push(this.createSemanticInfo(
              value,
              'string',
              location,
              filePath,
              lines,
              this.getContext(location, lines)
            ));
          }
        }

        // NEW! CROSS-REFERENCES: Function calls
        if (node.type === 'Call') {
          let functionName: string | null = null;
          
          if (node.func.type === 'Name') {
            // Direct call: function_name()
            functionName = node.func.id;
          } else if (node.func.type === 'Attribute') {
            // Method call: object.method()
            functionName = node.func.attr;
          }

          if (functionName) {
            references.push({
              targetTerm: functionName,
              referenceType: 'call',
              fromLocation: {
                file: filePath,
                line: location.line || 0,
                column: location.column || 0,
              },
              context: this.getContext(location, lines),
            });
          }
        }

        // NEW! Track imports
        if (node.type === 'Import' || node.type === 'ImportFrom') {
          const importedNames = node.names || [];
          importedNames.forEach((name: any) => {
            references.push({
              targetTerm: name.name,
              referenceType: 'import',
              fromLocation: {
                file: filePath,
                line: location.line || 0,
                column: location.column || 0,
              },
              context: this.getContext(location, lines),
            });
          });
        }
      });

      // Handle comments (implementation depends on parser)
      this.extractComments(content, filePath, lines, definitions);

    } catch (error) {
      console.warn(`Failed to parse Python file ${filePath}:`, error);
      return this.fallbackExtraction(content, filePath);
    }

    return { definitions, references }; // Return both!
  }

  private walkAst(node: any, callback: (node: any, location: any) => void) {
    // Implementation depends on your parser's API
    // Most parsers provide a visitor pattern or recursive traversal
  }

  // Copy these utility methods from TypeScriptExtractor and adapt as needed
  private createSemanticInfo(...args: any[]): SemanticInfo {
    // Same pattern as TypeScript extractor
  }

  private getContext(loc: any, lines: string[]): string {
    // Same implementation
  }

  private getSurroundingLines(lineNumber: number, lines: string[]): string[] {
    // Same implementation  
  }

  private extractRelatedTerms(context: string): string[] {
    // Adapt for Python identifier patterns
    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    // Python allows more unicode in identifiers, but this is a good start
  }

  private isMeaningfulString(value: string): boolean {
    // Same logic as TypeScript extractor
  }

  private fallbackExtraction(content: string, filePath: string): { definitions: SemanticInfo[]; references: CrossReference[] } {
    // Simple regex-based extraction for when parsing fails
    const definitions: SemanticInfo[] = [];
    const references: CrossReference[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Python function definition
      const functionMatch = line.match(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (functionMatch) {
        definitions.push({
          term: functionMatch[1],
          type: 'function',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'python',
        });
      }

      // Python class definition
      const classMatch = line.match(/^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (classMatch) {
        definitions.push({
          term: classMatch[1],
          type: 'class',
          location: { file: filePath, line: index + 1, column: 0 },
          context: line.trim(),
          surroundingLines: [line.trim()],
          relatedTerms: [],
          language: 'python',
        });
      }

      // String literals
      const stringMatches = line.match(/"([^"]{4,})"|'([^']{4,})'/g);
      if (stringMatches) {
        stringMatches.forEach(match => {
          const value = match.slice(1, -1);
          if (this.isMeaningfulString(value)) {
            definitions.push({
              term: value,
              type: 'string',
              location: { file: filePath, line: index + 1, column: 0 },
              context: line.trim(),
              surroundingLines: [line.trim()],
              relatedTerms: [],
              language: 'python',
            });
          }
        });
      }
    });

    return { definitions, references };
  }

  private extractComments(content: string, filePath: string, lines: string[], definitions: SemanticInfo[]): void {
    lines.forEach((line, index) => {
      const commentMatch = line.match(/#\s*(.+)/);
      if (commentMatch) {
        const comment = commentMatch[1].trim();
        if (comment.length > 5) {
          definitions.push({
            term: comment,
            type: 'comment',
            location: { file: filePath, line: index + 1, column: 0 },
            context: line.trim(),
            surroundingLines: [line.trim()],
            relatedTerms: [],
            language: 'python',
          });
        }
      }
    });
  }
}
```

**Key Adaptation Points**:
1. **Parser integration** - Replace Babel with your language's parser
2. **AST node types** - Each language has different node type names
3. **Identifier patterns** - Some languages have different naming rules
4. **Comment syntax** - `//` vs `#` vs `/* */`
5. **String literals** - Different quote styles and escaping rules

---

## Step 3: Test with Sample Code 🧪

**Create a test file for your new language:**

### Create `tests/extractors/python.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { PythonExtractor } from '../../src/semantic/extractors/PythonExtractor';

describe('PythonExtractor', () => {
  const extractor = new PythonExtractor();

  it('identifies Python files', () => {
    expect(extractor.canHandle('auth.py')).toBe(true);
    expect(extractor.canHandle('auth.js')).toBe(false);
  });

  it('extracts function names', () => {
    const code = `
def authenticate_user(email, password):
    """Validates user credentials"""
    return True
    `;
    
    const result = extractor.extract(code, 'test.py');
    expect(result.definitions).toContainEqual(
      expect.objectContaining({
        term: 'authenticate_user',
        type: 'function',
        language: 'python'
      })
    );
  });

  it('extracts cross-references', () => {
    const code = `
from auth import authenticate_user

def login(email, password):
    user = authenticate_user(email, password)
    return user
    `;
    
    const result = extractor.extract(code, 'test.py');
    
    // Check import reference
    expect(result.references).toContainEqual(
      expect.objectContaining({
        targetTerm: 'authenticate_user',
        referenceType: 'import',
      })
    );
    
    // Check function call reference
    expect(result.references).toContainEqual(
      expect.objectContaining({
        targetTerm: 'authenticate_user',
        referenceType: 'call',
      })
    );
  });

  it('extracts class names', () => {
    const code = `
class UserService:
    def __init__(self):
        pass
    `;
    
    const results = extractor.extract(code, 'test.py');
    expect(results).toContainEqual(
      expect.objectContaining({
        term: 'UserService',
        type: 'class',
        language: 'python'
      })
    );
  });

  it('extracts meaningful strings', () => {
    const code = `
raise ValueError("Invalid credentials provided")
    `;
    
    const results = extractor.extract(code, 'test.py');
    expect(results).toContainEqual(
      expect.objectContaining({
        term: 'Invalid credentials provided',
        type: 'string',
        language: 'python'
      })
    );
  });

  it('extracts comments', () => {
    const code = `
# TODO: Add password complexity validation
def validate_password(pwd):
    pass
    `;
    
    const results = extractor.extract(code, 'test.py');
    expect(results).toContainEqual(
      expect.objectContaining({
        term: 'TODO: Add password complexity validation',
        type: 'comment',
        language: 'python'
      })
    );
  });

  it('handles parsing errors gracefully', () => {
    const invalidCode = `
def broken_syntax(
    # Missing closing parenthesis
    pass
    `;
    
    // Should not throw, should return fallback results
    const results = extractor.extract(invalidCode, 'test.py');
    expect(Array.isArray(results)).toBe(true);
  });
});
```

**Run the tests:**
```bash
bun test tests/extractors/python.test.ts
```

---

## Step 4: Register the Extractor ✅

**Add your new extractor to the service:**

### Update `src/semantic/SemanticService.ts`:

```typescript
import { TypeScriptExtractor } from './extractors/TypeScriptExtractor';
import { PythonExtractor } from './extractors/PythonExtractor';
// Import other extractors as you add them

export class SemanticService {
  private extractors: LanguageExtractor[] = [
    new TypeScriptExtractor(),
    new PythonExtractor(), // Add your new extractor here
    // Add more as you implement them
  ];

  // Rest of the implementation stays the same
}
```

**That's it!** The extractor is now automatically used for `.py` files.

---

## Step 5: Add Language-Specific Concepts (Optional) 🎨

**Extend concept groups with language-specific terms:**

### Update `src/semantic/cli.ts`:

```typescript
const CONCEPT_GROUPS = {
  // Universal concepts
  auth: ["auth", "authenticate", "login", "signin", "credential", "token", "oauth", "jwt"],
  database: ["db", "database", "query", "sql", "mongo", "redis", "orm", "migration"],
  
  // Language-specific concepts
  python_web: ["django", "flask", "fastapi", "request", "response", "view", "model"],
  python_data: ["pandas", "numpy", "dataframe", "series", "matplotlib", "jupyter"],
  go_concurrency: ["goroutine", "channel", "mutex", "waitgroup", "select", "sync"],
  rust_ownership: ["borrow", "lifetime", "ownership", "move", "clone", "reference"],
};
```

**Usage:**
```bash
smartgrep python_web     # Find all Django/Flask related code
smartgrep go_concurrency # Find all Go concurrency patterns
```

---

## Cross-Reference Patterns by Language 🔍 (NEW!)

### Python Cross-References
```typescript
// Function calls
node.type === 'Call' && node.func.type === 'Name' // foo()
node.type === 'Call' && node.func.type === 'Attribute' // obj.foo()

// Class instantiation
node.type === 'Call' && isClassName(node.func.id) // MyClass()

// Inheritance
node.type === 'ClassDef' && node.bases // class Child(Parent)

// Imports
node.type === 'Import' // import module
node.type === 'ImportFrom' // from module import name
```

### JavaScript/TypeScript Cross-References
```typescript
// Function calls
node.type === 'CallExpression' // foo()
node.callee.type === 'MemberExpression' // obj.foo()

// Class instantiation  
node.type === 'NewExpression' // new MyClass()

// Inheritance
node.type === 'ClassDeclaration' && node.superClass // extends Parent

// Imports
node.type === 'ImportDeclaration' // import { foo } from 'bar'
```

### Go Cross-References
```typescript
// Function calls
node.type === 'CallExpr' // foo()
node.type === 'SelectorExpr' // pkg.Foo()

// Type usage
node.type === 'CompositeLit' // MyStruct{}

// Interface implementation (implicit in Go)
// Need to track method signatures

// Imports
node.type === 'ImportSpec' // import "fmt"
```

### Java Cross-References
```typescript
// Method calls
node.type === 'MethodInvocation' // foo()
node.type === 'MemberSelect' // obj.foo()

// Class instantiation
node.type === 'NewClass' // new MyClass()

// Inheritance & Implementation
node.type === 'ClassTree' && node.extendsClause // extends Parent
node.type === 'ClassTree' && node.implementsClause // implements Interface

// Imports
node.type === 'Import' // import com.example.Class
```

## Language-Specific Tips 💡

### Python Specifics
- **Imports**: `import`, `from ... import`
- **Decorators**: `@property`, `@classmethod`, `@decorator`
- **Magic methods**: `__init__`, `__str__`, `__call__`
- **Docstrings**: Triple-quoted strings as documentation
- **Cross-refs**: Track `super()` calls, decorator usage

### Go Specifics  
- **Package declarations**: `package main`
- **Interface definitions**: `type Reader interface`
- **Struct definitions**: `type User struct`
- **Go-specific comments**: `//go:generate`, `//go:build`

### Rust Specifics
- **Macros**: `println!`, `vec!`, custom macros
- **Traits**: `trait Display`  
- **Impl blocks**: `impl MyStruct`
- **Attributes**: `#[derive(Debug)]`, `#[cfg(test)]`

### Java Specifics
- **Annotations**: `@Override`, `@Component`, `@Service`
- **Package declarations**: `package com.example`
- **Interface implementations**: `implements Runnable`
- **Generics**: `List<String>`, `Map<K, V>`

---

## Common Pitfalls & Solutions ⚠️

### 1. Parser Installation Issues
**Problem**: Parser dependencies are complex or have native bindings

**Solution**: Use Tree-sitter for problematic languages - it's consistent and works everywhere

### 2. AST Structure Confusion  
**Problem**: Each parser has different AST node types and structures

**Solution**: Start with the fallback regex approach, then gradually improve with proper AST parsing

### 3. Performance Issues
**Problem**: Some parsers are slower than others

**Solution**: Add parser performance logging and consider async parsing for slow languages

### 4. Unicode and Encoding
**Problem**: Some languages allow complex unicode in identifiers

**Solution**: Start with ASCII-only patterns, expand as needed

### 5. Language Variants
**Problem**: Python 2 vs 3, ES6 vs ES5, etc.

**Solution**: Target the most common modern version, add variants later if needed

---

## Testing Checklist ✅

For each new language extractor:

- [ ] **File detection**: `canHandle()` correctly identifies file extensions
- [ ] **Function extraction**: Finds function/method definitions  
- [ ] **Class extraction**: Finds class/struct/interface definitions
- [ ] **Variable extraction**: Finds variable declarations and assignments
- [ ] **String extraction**: Finds meaningful string literals
- [ ] **Comment extraction**: Finds all comment types for the language
- [ ] **Import extraction**: Finds import/require/include statements
- [ ] **Error handling**: Gracefully handles syntax errors with fallback
- [ ] **Performance**: Processes files reasonably fast
- [ ] **Integration**: Works with the semantic service and CLI

---

## Language Priority Recommendations 🎯

**High Impact (Implement First)**:
1. **Python** - Huge ecosystem, data science, web development
2. **Go** - Growing rapidly, microservices, cloud infrastructure  
3. **Java** - Enterprise codebases, Android development
4. **Rust** - Systems programming, growing adoption

**Medium Impact**:
5. **C/C++** - Legacy systems, performance-critical code
6. **C#** - .NET ecosystem, enterprise applications
7. **PHP** - Web development, WordPress ecosystem
8. **Ruby** - Rails applications, scripting

**Lower Priority**:
9. **Swift** - iOS development (more specialized)
10. **Kotlin** - Android development (similar to Java)
11. **Scala** - Specialized use cases
12. **Haskell** - Academic and specialized functional programming

---

## Success Metrics 📊

For each language implementation, track:

- **Coverage**: What percentage of language constructs are captured?
- **Accuracy**: Are the extracted terms meaningful and correct?
- **Performance**: How fast is indexing compared to TypeScript?
- **Usefulness**: Do searches return helpful results for that language?
- **Robustness**: How well does it handle edge cases and errors?

---

**Remember**: Start simple, test thoroughly, and expand gradually. Each language addition should follow this exact pattern to avoid complexity and maintain consistency.
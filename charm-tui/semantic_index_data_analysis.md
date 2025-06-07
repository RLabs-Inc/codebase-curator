# Semantic Index Data Analysis

## Overview
The semantic index in smartgrep collects comprehensive metadata about code, but much of it is not displayed in the current CLI output. This document details ALL available data that could help Claude understand code better.

## Data Structure (from types.ts)

### SemanticInfo - Core Data Model
```typescript
export interface SemanticInfo {
  term: string;
  type: 'function' | 'class' | 'variable' | 'constant' | 'string' | 'comment' | 'import' | 'file';
  location: {
    file: string;
    line: number;
    column: number;
  };
  context: string; // The actual line of code
  surroundingLines: string[]; // 2-3 lines before/after for context
  relatedTerms: string[]; // Other terms found nearby
  language: string;
  metadata?: Record<string, any>; // Language-specific extra info
  references?: CrossReference[]; // Where this term is used
}
```

### CrossReference - Relationship Data
```typescript
export interface CrossReference {
  targetTerm: string;
  referenceType: 'call' | 'import' | 'extends' | 'implements' | 'instantiation' | 'type-reference';
  fromLocation: {
    file: string;
    line: number;
    column: number;
  };
  context: string;
}
```

### SearchResult - Enhanced with Usage Data
```typescript
export interface SearchResult {
  info: SemanticInfo;
  relevanceScore: number;
  usageCount?: number; // Number of times this term is referenced
  sampleUsages?: CrossReference[]; // Up to 3 example usages
}
```

## Collected Metadata by Language

### TypeScript/JavaScript (TypeScriptExtractor)
1. **Function Declarations**
   - Name, parameters (in context line)
   - Arrow functions and function expressions
   - Object methods and class methods
   - Method signatures in context

2. **Classes**
   - Class names and inheritance (`extends`)
   - Class methods (stored as `ClassName.methodName`)
   - Constructor patterns

3. **Variables/Constants**
   - Variable declarations with type annotations (in context)
   - Const vs let distinction (through context)

4. **Type System**
   - Type aliases (stored as 'class' type)
   - Interfaces (stored as 'class' type)
   - Type references in cross-references

5. **Imports/Exports**
   - Import statements with source modules
   - Export declarations
   - Named vs default exports

6. **Development Markers in Comments**
   - TODO, FIXME, HACK, XXX, BUG, OPTIMIZE, REFACTOR, NOTE, REVIEW, DEPRECATED, WORKAROUND, TEMP, KLUDGE, SMELL
   - Stored in metadata: `{ isDevelopmentMarker: true, markerType: "TODO" }`

7. **Cross-References**
   - Function calls (direct and method calls)
   - Class instantiation (`new ClassName()`)
   - Class inheritance relationships
   - Import usage tracking

### Python (PythonExtractor)
1. **Functions**
   - Function definitions with decorators
   - Class methods (including `__init__`, `__str__`, etc.)
   - Special methods tracked as interface implementations

2. **Classes**
   - Class definitions with inheritance
   - Multiple inheritance support
   - Base class references

3. **Variables**
   - Module-level variables
   - Class attributes
   - Constants (UPPER_CASE convention detected)

4. **Imports**
   - from...import statements
   - Import aliases
   - Module relationships in relatedTerms

5. **Decorators**
   - Decorator usage tracked as function calls

6. **Docstrings**
   - Multi-line docstrings with development markers
   - Docstring content indexed as comments

### Go (GoExtractor)
1. **Functions**
   - Function declarations
   - Method receivers
   - Package-level functions

2. **Structs/Interfaces**
   - Type definitions
   - Interface implementations

3. **Variables/Constants**
   - Package-level declarations
   - Const blocks

4. **Imports**
   - Import statements with aliases
   - Package usage tracking

### Configuration Files
1. **JSON (JsonExtractor)**
   - Keys as 'variable' type
   - String values indexed
   - Nested structure preserved in context

2. **YAML (YamlExtractor)**
   - Key-value pairs
   - Special handling for:
     - Docker Compose services
     - Kubernetes resources
     - GitHub Actions workflows
     - GitLab CI pipelines

3. **TOML (TomlExtractor)**
   - Table headers
   - Key-value pairs
   - Special handling for Cargo.toml

4. **Environment Files (EnvExtractor)**
   - Environment variables
   - Values (with sensitive data filtering)

## Hidden/Underutilized Data

### 1. Context and Surrounding Lines
- **Current**: Only showing single line of context
- **Available**: 2-3 lines before/after for better understanding
- **Benefit**: Would show function signatures, class context, import groups

### 2. Related Terms
- **Current**: Not displayed at all
- **Available**: Other identifiers found on the same line
- **Benefit**: Shows what APIs/variables are used together

### 3. Cross-References and Usage Patterns
- **Current**: Only showing sample usages for functions/classes
- **Available**: Complete reference graph including:
  - All call sites
  - Import locations
  - Inheritance chains
  - Type usage
- **Benefit**: Full dependency understanding

### 4. Language-Specific Metadata
- **Current**: Only development markers shown occasionally
- **Available**: Could include:
  - Function parameter counts
  - Return type indicators (from context parsing)
  - Async/sync indicators
  - Public/private modifiers (from context)
  - Generic type parameters

### 5. File-Level Relationships
- **Current**: Not shown
- **Available**: Which files import/use which other files
- **Benefit**: Architecture understanding

### 6. Statistical Data
- **Current**: Usage count shown but limited
- **Available**: Could show:
  - Usage frequency rankings
  - Complexity indicators (based on reference patterns)
  - "Hot spots" (highly referenced items)

## Recommendations for Better Claude Integration

### 1. Enhanced JSON Output Mode
Create a `--json-full` mode that includes ALL metadata:
```json
{
  "term": "processPayment",
  "type": "function",
  "signature": "async processPayment(order: Order, card: Card): Promise<Receipt>",
  "location": { "file": "src/payment.ts", "line": 45, "column": 0 },
  "context": "export async function processPayment(order: Order, card: Card): Promise<Receipt> {",
  "surroundingLines": [
    "// Process customer payment",
    "export async function processPayment(order: Order, card: Card): Promise<Receipt> {",
    "  const validation = await validateCard(card);",
    "  if (!validation.isValid) {"
  ],
  "relatedTerms": ["Order", "Card", "Receipt", "validateCard"],
  "language": "typescript",
  "metadata": {
    "isAsync": true,
    "isExported": true,
    "parameterCount": 2
  },
  "references": [
    {
      "type": "call",
      "from": "src/checkout.ts:89",
      "context": "const receipt = await processPayment(order, customerCard);"
    }
  ],
  "usageCount": 12,
  "callsToOtherFunctions": ["validateCard", "chargeCard", "sendReceipt"]
}
```

### 2. Graph Output Mode
A `--graph` mode showing relationships:
```
processPayment [function]
  ├─ Called by:
  │  ├─ completeCheckout() at checkout.ts:89
  │  ├─ retryPayment() at retry.ts:23
  │  └─ processRefund() at refund.ts:45
  ├─ Calls:
  │  ├─ validateCard()
  │  ├─ chargeCard()
  │  └─ sendReceipt()
  ├─ Parameters:
  │  ├─ order: Order
  │  └─ card: Card
  └─ Returns: Promise<Receipt>
```

### 3. Architecture Overview Mode
A `--architecture` mode showing file-level dependencies:
```
src/payment.ts
  ├─ Imports from:
  │  ├─ ./types (Order, Card, Receipt)
  │  ├─ ./validation (validateCard)
  │  └─ ./api/stripe (chargeCard)
  ├─ Imported by:
  │  ├─ checkout.ts
  │  ├─ retry.ts
  │  └─ refund.ts
  └─ Exports:
     ├─ processPayment (function)
     └─ PaymentError (class)
```

### 4. Context-Aware Mode
A `--context` mode that includes more surrounding code:
- Full function signatures
- Complete class definitions
- Import blocks
- Related type definitions

## Implementation Priority

1. **High Priority** (Most valuable for Claude):
   - Full function signatures in context
   - Complete cross-reference data
   - Import/export relationships
   - Type information from context

2. **Medium Priority**:
   - Related terms
   - Surrounding lines
   - Development markers
   - File-level dependencies

3. **Lower Priority**:
   - Statistical analysis
   - Complexity metrics
   - Historical change data
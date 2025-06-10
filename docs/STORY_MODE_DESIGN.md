# Story Mode - Understanding Codebases Through Narrative 📚

## The Innovation

Every codebase tells a story through its strings:
- Error messages reveal what can go wrong
- Log messages show the flow of execution  
- API endpoints expose system boundaries
- State transitions reveal business logic

We're building a way to extract and visualize these stories!

## Usage Examples

### 1. Basic Story Mode
```bash
# Analyze the story around a concept
smartgrep story "payment"

# Output:
📚 THE CODEBASE STORY
════════════════════════════════════════════════════════════════

┌─ 🌊 PROCESS FLOWS ─────────────────────────────┐
│
│ 📖 Payment Flow
│
│   🚀 "Initiating payment process"
│     ├─❌ "Payment validation failed"
│     ↓
│   ✓ "Validating payment details"
│     ├─❌ "Invalid card number"
│     ↓
│   ⚙️ "Processing payment with Stripe"
│     ├─❌ "Payment gateway timeout"
│     ↓
│   ✅ "Payment successful - ID: {}"
└────────────────────────────────────────────────┘

┌─ 🎭 THE ACTORS ────────────────────────────────┐
│
│ 🌐 External Services
│   • stripe.com
│     "https://stripe.com/v1/charges"
│     "Stripe API key not configured"
│   • paypal.api.com
│     "https://paypal.api.com/v2/checkout"
│
│ 💾 Data Stores
│   • payments
│     "INSERT INTO payments (user_id, amount)"
│     "SELECT * FROM payments WHERE status = ?"
└────────────────────────────────────────────────┘
```

### 2. Story Flows
```bash
# Find all process flows in the codebase
smartgrep story --flows

# Find flows for a specific feature
smartgrep story "upload" --flows
```

### 3. Actor Analysis
```bash
# Who are the actors in this system?
smartgrep story --actors

# What external services do we depend on?
smartgrep story --actors external
```

### 4. Conflict Analysis
```bash
# What can go wrong?
smartgrep story --conflicts

# Top errors by frequency
smartgrep story --conflicts --top 10
```

## Implementation Plan

### Phase 1: String Classification
- Enhance extractors to classify strings by narrative type
- Store classification metadata in semantic index

### Phase 2: Story Extraction
- Build StoryAnalyzer to find patterns
- Detect flows, actors, states, conflicts

### Phase 3: Beautiful Display
- Create narrative visualizations
- Show process flows as diagrams
- Group related stories

### Phase 4: Integration
```bash
# New commands
smartgrep story <query>        # Full story analysis
smartgrep story --flows        # Just show process flows
smartgrep story --actors       # Just show actors
smartgrep story --conflicts    # Just show what can go wrong
smartgrep story --states       # Just show state machines
```

## Why This Matters

1. **Faster Understanding**: See the business logic at a glance
2. **Better Debugging**: Understand error scenarios instantly
3. **Architecture Discovery**: Find all external dependencies
4. **Documentation from Code**: The strings ARE the documentation

## Technical Details

### String Classification Engine
```typescript
class StringClassifier {
  classify(str: string): StringType {
    // Detect API endpoints
    if (/^\/api\/|https?:\/\//.test(str)) return 'endpoint'
    
    // Detect SQL queries
    if (/SELECT|INSERT|UPDATE|DELETE/i.test(str)) return 'sql'
    
    // Detect error messages
    if (/error|failed|cannot|invalid/i.test(str)) return 'error'
    
    // Detect state transitions
    if (/status:|state:|phase:/i.test(str)) return 'state'
    
    // And many more patterns...
  }
}
```

### Flow Detection Algorithm
```typescript
// Find sequences of strings that appear together
// in execution paths to build process flows
function detectFlows(strings: StringInfo[]): ProcessFlow[] {
  // Group by location (file + function)
  // Order by narrative type (init → process → complete)
  // Link error branches
  // Build flow graph
}
```

### Smart Display
- Use terminal colors to highlight different story elements
- Show flows as ASCII diagrams
- Group actors by type
- Sort conflicts by frequency

## Future Enhancements

1. **Interactive Mode**: Navigate through stories
2. **Story Diff**: How did the story change between versions?
3. **Story Validation**: Do the strings match the actual code flow?
4. **Export Stories**: Generate documentation from stories

## The Vision

Imagine understanding a new codebase in minutes by reading its story:
- What it does (flows)
- Who it talks to (actors)
- What can go wrong (conflicts)
- How it transitions (states)

All extracted from the strings that were already there!
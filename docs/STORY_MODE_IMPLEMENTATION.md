# Story Mode Implementation Plan 📚

## Overview
Story Mode extracts narrative patterns from codebase strings to help Claudes understand:
- Process flows (what leads to what)
- Error scenarios (what can go wrong)
- External boundaries (who we talk to)
- Common patterns (what repeats)

## Implementation Steps

### Phase 1: Core Story Extraction
1. **Create StoryExtractor class** in `semantic-core`
   - Extract flows from sequential strings
   - Find error patterns and recovery
   - Identify external boundaries
   - Detect universal patterns (retry, validation, state changes)

2. **Enhance SemanticService**
   - Add `extractStory()` method
   - Store story metadata in index
   - Update incrementally with file changes

### Phase 2: Story Integration in Search
1. **Enhance Compact Output**
   - Add story context section after header
   - Show where term fits in flows
   - Display relevant error patterns
   - Keep it brief (3-5 lines max)

2. **Enhance Full Output**
   - Add story navigation section at end
   - Show all flows containing the term
   - List related boundaries
   - Suggest story exploration commands

### Phase 3: Story Command
1. **Add `story` subcommand to CLI**
   ```bash
   smartgrep story [query] [options]
   --flows      # Show only process flows
   --errors     # Show only error scenarios
   --boundaries # Show only external dependencies
   --patterns   # Show only recurring patterns
   ```

2. **Create Story Display**
   - Beautiful ASCII flow diagrams
   - Categorized error scenarios
   - Grouped boundaries by type
   - Pattern examples

## File Structure

```
src/packages/semantic-core/src/
├── analyzers/
│   ├── StoryExtractor.ts      # Main story extraction logic
│   └── UniversalPatterns.ts   # Universal programming concepts
├── types/
│   └── story.ts              # Story-related types
└── SemanticService.ts        # Add story extraction methods

src/tools/smartgrep/
├── storyDisplay.ts           # Beautiful story visualization
├── storyIntegration.ts       # Integration with search results
└── cli.ts                    # Add story command
```

## Story Extraction Algorithm

### 1. Flow Detection
```typescript
// Find sequences of strings that appear together
// Group by location (file + function)
// Order by temporal markers (start → process → complete)
// Branch on error markers
```

### 2. Error Pattern Detection
```typescript
// Find strings with error/fail/invalid markers
// Look for nearby recovery strings (retry, fallback)
// Group by error category (auth, validation, network)
// Count frequency
```

### 3. Boundary Detection
```typescript
// External APIs: URLs not localhost
// Databases: SQL queries, collection names
// Files: File paths, extensions
// Config: Environment variables, settings
```

### 4. Universal Pattern Detection
```typescript
// Retry: "attempt N of M", "retrying"
// Validation: "invalid", "required", "must"
// State: "status:", "state:", transitions
// Lifecycle: create → update → delete
```

## Display Examples

### Compact Mode Enhancement
```
🔍 SMARTGREP: "processPayment" (5 results)

📖 STORY CONTEXT:
   Part of: Payment Flow (occurs 127 times)
   Flow: validateCard → processPayment → updateInventory
   Can fail: CardDeclined, NetworkTimeout
   External: stripe.com

📍 DEFINITION: PaymentService.ts:42
[... rest of normal output ...]
```

### Full Story Display
```
📚 STORY: "payment"
════════════════════════════════════════════════

🌊 PROCESS FLOWS
─────────────────
📖 Payment Processing (127 occurrences)
   Creating order
   ↓
   Validating card
   ↓
   ▶ Processing payment
   ├─❌ Payment failed
   │   └─ Retry payment
   ↓
   Order complete

⚠️ ERROR SCENARIOS
──────────────────
🔐 AUTHENTICATION
   • "Token expired" → Redirect to login
   • "Invalid API key" → Check config

💳 PAYMENT ERRORS  
   • "Card declined" → Show error form
   • "Insufficient funds" → Suggest other payment

🌐 EXTERNAL SYSTEMS
───────────────────
APIs:
   • stripe.com - Payment processing
   • sendgrid.com - Email notifications

Databases:
   • orders - Order storage
   • payments - Transaction log
```

## Integration Points

1. **SemanticService**
   - `extractStory(searchResults)` - Extract story from results
   - `getStoryForTerm(term)` - Get pre-computed story
   - `updateStoryIndex()` - Update story during indexing

2. **Search Results**
   - Compact: Add 3-5 lines of story context
   - Full: Add story navigation section
   - Both: Only show relevant story elements

3. **CLI Command**
   - Parse story subcommand
   - Handle options (--flows, --errors, etc.)
   - Call story display methods

## Performance Considerations

1. **Story Extraction**
   - Run during indexing, not search
   - Store story metadata in index
   - Update incrementally

2. **Display**
   - Compute story context quickly
   - Cache formatted output
   - Limit displayed items

## Success Criteria

1. **For Regular Search**
   - Story context adds <100ms to search
   - Context is relevant and concise
   - Helps understand code relationships

2. **For Story Command**
   - Extracts meaningful flows
   - Categories errors accurately  
   - Identifies real boundaries
   - Beautiful, readable output

## Next Steps

1. Implement StoryExtractor
2. Enhance SemanticService
3. Update search displays
4. Add story command
5. Test with real codebases
6. Refine patterns based on results
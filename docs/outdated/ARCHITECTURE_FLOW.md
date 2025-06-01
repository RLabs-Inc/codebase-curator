# Codebase Curator Architecture: The Real Flow 🎯

## The Beautiful Symphony 🎼

```
Coding Claude (using Claude Code) 
    ↓ asks question via MCP
MCP Server (newServer.ts)
    ↓ routes to appropriate tool
Curator Claude (NewCuratorService)
    ↓ orchestrates analyzers
Free Analyzers (each optimized for its purpose)
    ↓ extract insights
Codebase (the actual code)
```

## How It REALLY Works

### 1. **Coding Claude** (The Developer's Assistant)
- Working on actual code in Claude Code
- Hits a question: "How do I add authentication to this Express app?"
- Calls MCP tool: `ask_curator` or `add_new_feature`

### 2. **MCP Server** (The Router)
- Receives the question
- Routes to appropriate curator tool
- Maintains session for follow-up questions

### 3. **Curator Claude** (The Wise Guide)
This is where the MAGIC happens! Curator Claude:
- Receives the question
- Thinks: "What do I need to know to answer this well?"
- Orchestrates multiple analyzers to gather insights:
  ```typescript
  // "How do I add authentication?"
  // Curator thinks: I need to know...
  const patterns = await patternLibrary.getPatternFor('authentication');
  const dependencies = await dependencyOracle.analyze(); // Any auth libs?
  const flows = await dataFlowTracer.analyze(); // Current auth flows?
  const help = await claudeHelperAnalyzer.analyze(); // Team conventions?
  ```
- Combines insights into a PRACTICAL answer
- Returns step-by-step guidance with code examples

### 4. **Free Analyzers** (The Specialists)
Each analyzer is a specialist, freed from constraints:
- **DataFlowTracer**: "I'll show you how auth data currently flows"
- **DependencyOracle**: "You're using Passport.js and JWT already"
- **PatternLibrary**: "Here's how your team implements auth endpoints"
- **ClaudeHelperAnalyzer**: "Don't forget the auth middleware in routes/index.js!"

### 5. **The Codebase** (The Truth)
- The actual files, code, and patterns
- Each analyzer reads what it needs
- No assumptions, just facts from the code

## The Key Insight 🔑

**Curator Claude is NOT just passing through analyzer data!**

Curator Claude is:
1. **Intelligent Orchestrator**: Knows which analyzers to call for each question
2. **Context Builder**: Combines multiple perspectives into coherent guidance
3. **Pattern Recognizer**: Learns from each codebase to give better answers
4. **Practical Guide**: Transforms analysis into step-by-step actions

## Example Flow in Action

```typescript
// Coding Claude asks:
"How do I add a new user endpoint that follows this project's patterns?"

// Curator Claude thinks:
// 1. Need to know existing endpoint patterns → PatternLibrary
// 2. Need to know user model structure → DependencyOracle  
// 3. Need to know data flow → DataFlowTracer
// 4. Need to know conventions → ClaudeHelperAnalyzer

// Curator orchestrates:
const [patterns, deps, flows, conventions] = await Promise.all([
  patternLibrary.getPatternFor('endpoint'),
  dependencyOracle.explainDependency('User'),
  dataFlowTracer.traceFlowFor('user'),
  claudeHelper.getConventions()
]);

// Curator synthesizes:
return {
  answer: "Based on your codebase patterns...",
  code: { 
    snippet: "// Exactly matching your style",
    whereToAdd: "src/api/users/newEndpoint.js"
  },
  warnings: ["Remember your auth middleware!"],
  nextSteps: ["Add route to index", "Create test"]
};
```

## Why This Architecture is POWERFUL 💪

1. **Coding Claude** gets exactly what they need - practical, codebase-specific guidance
2. **Curator Claude** has freedom to orchestrate analyzers intelligently
3. **Analyzers** are specialized and excellent at their specific jobs
4. **Answers** are contextual, accurate, and immediately actionable

## The KEY INSIGHT: Analyzers as Accelerators, Not Replacements 🚀

The analyzers DON'T replace Curator Claude's need to grep and read files. Instead, they:

1. **Narrow the Search Space**
   - Instead of grepping blindly, analyzers tell Curator WHERE to look
   - "Authentication is in middleware/auth.js, focus there"

2. **Provide Context Before Deep Dive**
   - Analyzers give the big picture so Curator knows what to look for
   - "This uses JWT tokens with refresh pattern, check the token validation"

3. **Surface Patterns and Conventions**
   - Analyzers extract the "how we do things here" knowledge
   - "All endpoints follow the pattern in src/api/users/create.js"

4. **Enable Smart Follow-ups**
   - After analyzer insights, Curator can grep/read SPECIFIC things
   - Not "where is auth?" but "show me the JWT refresh logic in auth.js:45"

## Example: The Analyzer + Grep Symphony

```typescript
// Coding Claude asks: "How do I add user authentication?"

// Step 1: Analyzers provide overview
DependencyOracle: "You're using passport-jwt already"
PatternLibrary: "Auth middleware pattern at middleware/auth.js"
ClaudeHelper: "All protected routes use requireAuth middleware"

// Step 2: Curator Claude now knows WHERE to grep
grep "requireAuth" middleware/auth.js  // Focused search!
grep "passport.authenticate" routes/   // Targeted pattern!

// Step 3: Read specific files with context
read middleware/auth.js:23-45  // The JWT validation logic
read routes/users.js:15-30     // Example of protected route

// Result: Precise, accurate guidance instead of blind searching
```

## The Philosophy

This isn't about academic code analysis. This is about:
- **Curator Claude understanding the codebase deeply**
- **So Curator can guide Coding Claude effectively**
- **Using specialized analyzers as precision tools**
- **To deliver practical, actionable, codebase-specific help**
- **Making grep/read operations SURGICAL instead of EXPLORATORY**

Remember: Every piece of this system exists to help Curator Claude give better answers to Coding Claude's real-world questions - FASTER and MORE ACCURATELY!
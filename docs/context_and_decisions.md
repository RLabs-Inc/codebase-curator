# Context and Technical Decisions

## Historical Context

### Previous Attempts and Lessons Learned

**The "Aimed for the Stars" Attempt:**
- Built a sophisticated 15,000+ line TypeScript system
- 7+ analyzers with vector embeddings, semantic analysis, data flow mapping
- Each analyzer worked individually and collected valuable data
- **Fatal mistake:** Tried to unify analyzers before validating their individual value
- Integration coordinator grew to 2000+ lines
- Shared context became 2000+ lines  
- Lost working system to complexity hell
- **Never committed the working pieces**

**Key lesson:** "This is optimization thinking when you needed validation thinking. The 'duplicate effort' wasn't the problem - not knowing if the effort was valuable was the problem!"

### Why We're Taking a Different Approach

1. **Validation before optimization** - Build simple, see if it's useful, THEN improve
2. **Individual algorithm testing** - Each piece must work alone before integration
3. **Commit early and often** - Don't lose working progress
4. **Real-world testing** - Use messy, actual codebases, not clean examples
5. **Incremental value** - Each algorithm should provide standalone benefit

## Technical Decisions and Rationale

### Why Bun Instead of Node.js
- **Fast TypeScript setup** - No configuration overhead
- **Great developer experience** - Built-in testing, bundling, package management
- **Single runtime** - Less complexity than Node.js + tooling
- **Performance** - Faster startup for CLI tools
- **Modern** - Designed for current TypeScript/JavaScript ecosystem

### Why MCP Architecture
- **Natural integration** with Claude Code
- **Clean separation** between analysis logic and tool interface
- **Extensible** - Easy to add new tools without changing core
- **Standard protocol** - Works with multiple AI systems
- **Cost effective** - Works within Claude Code subscription model

### Why Start with CLI Before MCP
- **Faster development** - Direct testing without protocol overhead
- **Better debugging** - Can inspect outputs easily
- **Validation focused** - See if algorithms produce useful results
- **Incremental complexity** - Add MCP wrapper only after core works

### Cost Optimization Strategy

**Context:** User in Brazil faced extreme API costs ($50-100 USD daily, now $200 USD monthly unlimited)

**Strategy:** Build on Claude Code subscription model instead of API calls:
- Use Claude Code CLI with JSON output for "API-like" behavior
- Leverage monthly subscription for unlimited usage
- Enable global access to advanced AI coding tools
- Make tool available to developers regardless of economic situation

### Architecture: Clean Layered Design

```
┌─────────────────────────────────────────────────────────┐
│                  Presentation Layer                      │
│  ┌─────────────┐      ┌─────────────┐                  │
│  │ CLI App     │      │ MCP Server  │                  │
│  │ (src/       │      │ (src/       │                  │
│  │ presentation│      │ presentation│                  │
│  │ /cli/)      │      │ /mcp/)      │                  │
│  └─────────────┘      └─────────────┘                  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                     Core Layer                          │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐    │
│  │ Analysis     │  │ Curator     │  │ Session    │    │
│  │ Service      │  │ Service     │  │ Service    │    │
│  └──────────────┘  └─────────────┘  └────────────┘    │
│         │                  │                │           │
│  ┌──────▼──────────────────▼────────────────▼─────┐    │
│  │          CuratorProcessService                 │    │
│  │     (Manages Claude CLI subprocess)            │    │
│  └────────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 Infrastructure Layer                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Algorithms   │  │ Languages    │  │ Services     │  │
│  │ (importMap, │  │ (TypeScript, │  │ (context     │  │
│  │ framework,  │  │ Python       │  │  manager)    │  │
│  │ etc.)       │  │ plugins)     │  │              │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- **Presentation Layer:** User interfaces (CLI and MCP server)
- **Core Layer:** Business logic and orchestration services
- **Infrastructure Layer:** Technical implementations (algorithms, language plugins, utilities)

## Why These 5 Specific Algorithms

**Language Scope:** Starting with TypeScript/JavaScript only to validate the approach thoroughly before expanding to other languages.

### 1. Import/Dependency Mapping
**Problem:** AI assistants don't know what's already available in a codebase
**Solution:** Map what imports what, identify internal vs external dependencies
**Value:** Prevents reimplementing existing functionality, suggests appropriate imports

### 2. Framework/Library Detection  
**Problem:** AI suggests solutions incompatible with existing tech stack
**Solution:** Identify frameworks and libraries from import patterns
**Value:** Ensures suggestions match project's technology choices

### 3. File Organization Analysis
**Problem:** AI doesn't know where different types of code should go
**Solution:** Analyze directory structure and file placement patterns
**Value:** Guides where to put new code to match project organization

### 4. Pattern Aggregation
**Problem:** AI creates inconsistent approaches to similar problems
**Solution:** Identify repeated structural patterns in existing code
**Value:** Helps maintain consistency by following established patterns

### 5. Code Similarity Clustering
**Problem:** AI doesn't recognize related code that should evolve together
**Solution:** Group similar functions/classes by structure and purpose
**Value:** Reveals code relationships that aren't obvious from directory structure

## Data/Event Flow Vision (Future Evolution)

**Core insight:** All code exists to transform data or handle events

**Universal representation:**
- Data transformations: input → processing → output
- Event handling: event → state change → action/other events

**Evolution path:**
1. **Phase 1:** Simple structural analysis (current plan)
2. **Phase 2:** Semantic enrichment of structural analysis
3. **Phase 3:** Full data/event flow mapping using structural foundation

**Why not start with flow analysis:** 
- Too complex to implement reliably across diverse codebases
- Structural analysis provides necessary foundation
- Need validation that simpler approaches provide value first

## Real-World Codebase Challenges

### The Messy Reality We Must Handle
- **Legacy archaeological layers** - Mixed architectural styles across time
- **Inconsistent patterns** - Some files follow conventions, others don't
- **Scattered infrastructure** - Config in multiple places and formats
- **Mystery dependencies** - Imports that work but unclear why
- **Dead code graveyards** - Unused functions that still exist
- **Tribal knowledge** - Critical logic in undocumented places

### Our Strategy for Handling Complexity
1. **Probabilistic confidence** - Algorithms report confidence levels, not certainties
2. **Multiple evidence sources** - Combine different signals for robustness
3. **Graceful degradation** - Provide useful insights even with incomplete information
4. **Error tolerance** - Continue processing when individual files fail
5. **Pattern emergence** - Let patterns emerge from data rather than imposing expectations

## Success Validation Strategy

### Individual Algorithm Success
- Produces useful insights when run on diverse real codebases
- Confidence levels correlate with human assessment of accuracy
- Runs without crashing on codebases with 1000+ files
- Completes analysis in reasonable time (< 1 minute for medium projects)

### Integrated System Success  
- Combined output provides better codebase understanding than file browsing
- MCP tools give architectural guidance that keeps AI code consistent
- Curator can answer architectural questions with specific, actionable advice
- Tool feels genuinely helpful rather than just technically impressive

### Long-term Success
- Reduces pattern divergence in AI-generated code
- Enables architectural consistency across AI coding sessions
- Provides foundation for more sophisticated analysis (semantic, data flow)
- Becomes genuinely easier to use than traditional code exploration tools

## Open Source Goals

- **Day one open source** - Benefit broader developer community immediately
- **Global accessibility** - Enable developers worldwide to use advanced AI coding tools
- **Community evolution** - Let others contribute improvements and adaptations
- **Learning resource** - Demonstrate effective AI-first code analysis approaches

## Technical Debt and Evolution Management

### Avoiding Previous Mistakes
1. **No premature abstraction** - Build concrete solutions first
2. **No shared state complexity** - Keep algorithms independent
3. **No coordination protocols** - Simple input/output interfaces
4. **No generic solutions** - Solve specific problems first, generalize later

### Planned Evolution Path
1. **Validate core value** with minimal implementation
2. **Add semantic enrichment** to structural analysis  
3. **Introduce vector similarity** for pattern matching
4. **Build data flow analysis** on proven structural foundation
5. **Add machine learning** only after human validation

### Maintaining Simplicity
- **Regular simplification reviews** - Remove unused features
- **Complexity budgets** - Limit maximum file/function sizes
- **Single responsibility** - Each component does one thing well
- **Clear interfaces** - Minimal, well-defined APIs between components

This approach learns from painful experience with complexity and prioritizes sustainable value delivery over technical impressiveness.
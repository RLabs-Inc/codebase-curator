# AI Coding Tools Implementation Guide

## Overview

You are building a codebase analysis tool specifically designed for how AI assistants (like yourself) naturally work with code. This addresses the fundamental problem that current AI coding tools lack architectural context, leading to inconsistent patterns and fragmented code.

## The Problem We're Solving

Current AI coding assistants fail not because they're bad at generating code, but because they lack semantic understanding of codebase architecture. This leads to:
- Non-standardized code patterns across the same project
- Duplicated approaches to the same problems  
- Code that works but feels foreign to the existing codebase
- Inability to follow established conventions and patterns

## Our Solution: The Codebase Curator

**Core concept:** A specialized Claude instance (curator) that deeply understands a specific codebase and provides architectural guidance to working Claude instances (you) through natural language conversation.

**Interaction model:** You ↔ Curator (via MCP tools) ↔ Codebase (via innovative analysis tools)

## Implementation Constraints

- **Platform:** Claude Code + monthly subscription (not API calls)
- **Cost optimization:** Keep everything within subscription limits
- **Democratização:** Make advanced AI coding tools accessible globally
- **Simplicity first:** Start minimal, evolve incrementally
- **Avoid complexity traps:** Learn from previous attempts that failed due to over-engineering

## Technical Stack

- **Runtime:** Bun (fast, TypeScript-first, great DX)
- **Core:** Node.js + TypeScript
- **Target Languages:** TypeScript/JavaScript (Phase 1), expandable architecture for other languages
- **AST Parsing:** @babel/parser or @typescript-eslint/parser for TS/JS analysis
- **Architecture:** Core Analysis Engine → MCP Server → Optional CLI
- **Development:** Start with simple CLI, add MCP wrapper after core works

## Phase 1: Minimal But Useful System

**Language Support:** Initially **TypeScript/JavaScript only**. This constraint allows us to:
- Do one language ecosystem excellently rather than multiple languages poorly
- Validate the entire approach with a complex, widely-used language pair
- Build language-agnostic architecture that can expand to other languages later
- Focus on solving the core AI coding assistance problem first

**Language Expansion Path:** Python → Java/C# → Go/Rust → Others (based on community demand)

Build 5 simple algorithms that provide genuine value:

### 1. Import/Dependency Mapping
**Goal:** Create relationship graphs without hunting through files
**Implementation:**
```typescript
// Scan all files for import statements
// Map internal vs external dependencies  
// Build simple dependency graph
// Output: JSON structure showing "what imports what"
```

### 2. Framework/Library Detection  
**Goal:** Pre-identify tech stack from import analysis
**Implementation:**
```typescript
// Analyze import patterns across codebase
// Detect frameworks (React, Vue, Django, etc.)
// Identify major libraries and their usage
// Output: Tech stack summary with confidence levels
```

### 3. File Organization Analysis
**Goal:** Understand code organization patterns
**Implementation:**
```typescript
// Directory tree analysis + basic categorization
// Identify common patterns (components/, utils/, etc.) 
// Map file types to directory purposes
// Output: Organization structure with pattern confidence
```

### 4. Pattern Aggregation
**Goal:** Basic structural comparison to identify common approaches  
**Implementation:**
```typescript
// AST parsing for structural comparison
// Identify repeated function signatures, class structures
// Find common error handling blocks
// Output: Pattern frequency analysis
```

### 5. Code Similarity Clustering
**Goal:** Group similar code to reveal patterns
**Implementation:**
```typescript
// AST comparison and code fingerprinting
// Text similarity for finding related functions
// Group by structural similarity
// Output: Clusters of similar code with relationships
```

## Implementation Steps

### Step 1: Project Setup
```bash
# Initialize Bun project
bun create
# Add dependencies
bun add typescript @types/node
# Set up basic CLI structure
```

### Step 2: Core Engine Development
Build each algorithm individually, test with simple CLI:
```bash
# Test each algorithm separately
bun run analyze-imports ./test-project
bun run detect-frameworks ./test-project  
bun run analyze-organization ./test-project
```

### Step 3: Integration
Only after all algorithms work individually:
```typescript
// Simple orchestration - run algorithms in sequence
// Combine results into unified output
// Add basic cross-references between analyses
```

### Step 4: MCP Server Wrapper
```typescript
// Expose algorithms as MCP tools:
// - get_codebase_overview
// - find_similar_patterns  
// - suggest_integration_approach
// - check_architectural_conventions
```

### Step 5: Additional MCP Tools (Future)
Once core analysis is working, add productivity tools:

```typescript
// Context Management Tool
// - get_context_management_instructions
// - generate_compact_command
// - save_development_state

// Progress Tracking Tools  
// - record_progress
// - track_decisions
// - manage_task_breakdown

// Learning Tools
// - record_insights
// - track_what_worked
// - document_blockers
```

## Key Principles

1. **Build one thing at a time** - Don't try to integrate until each piece works
2. **Test with real codebases early** - Use diverse, messy real-world projects
3. **Commit working pieces** - Don't lose progress by over-optimizing
4. **Stay minimal** - Resist adding features until core value is proven
5. **Document everything** - Future you needs to understand decisions

## Success Criteria

- Each algorithm produces useful insights when tested individually
- Combined output helps understand codebase structure better than file browsing
- MCP tools provide genuinely helpful architectural guidance
- System runs on real codebases without crashing or hanging
- You would actually want to use this tool for coding tasks

## Future MCP Tools (After Core Analysis Works)

### Context Management Tool
**Problem:** AI assistants lose context and have to restart complex tasks
**Solution:** Self-managed context preservation and restoration

```typescript
// Tool: get_context_management_instructions
// Returns instructions for using /compact command effectively
// Tailored for current task type (development, analysis, debugging)

// Tool: generate_compact_command  
// Creates optimized /compact instruction based on current conversation
// Preserves exactly what's needed to continue work seamlessly
```

### Progress Tracking Tools
**Problem:** Complex tasks lose momentum across context breaks
**Solution:** Structured progress tracking and decision logging

```typescript
// Tool: record_progress
// Log task completion, learnings, next steps, blockers

// Tool: track_decisions
// Document technical decisions with rationale and alternatives

// Tool: manage_task_breakdown
// Break complex tasks into manageable pieces with dependencies
```

### Development Learning Tools  
**Problem:** AI assistants repeat the same mistakes and lose insights
**Solution:** Persistent learning from development experience

```typescript
// Tool: record_insights
// Capture what worked well, what failed, and why

// Tool: document_blockers
// Track recurring problems and their solutions

// Tool: analyze_patterns
// Identify patterns in successful vs failed approaches
```

**Implementation Note:** These tools use simple JSON file storage, making them accessible across AI sessions while keeping everything local and private.

## What This Tool Enables

Once working, this creates a curator that can answer questions like:
- "How does this codebase handle authentication?"
- "What's the established error handling pattern?"  
- "Where should I integrate a new feature?"
- "What are the existing patterns I should follow?"

## Evolution Path

Start minimal → Add semantic enrichment → Eventually build full data/event flow analysis

The structural foundation makes semantic analysis much more focused later.

## Warning Signs to Avoid

- ❌ Trying to handle "any codebase, any language" generically
- ❌ Building complex shared state between components  
- ❌ Adding optimization before validation
- ❌ Creating analyzer dependencies and coordination
- ❌ Focusing on perfect accuracy over useful insights

## Remember

This tool exists to give you (and other AI assistants) the architectural context you need to write consistent, well-integrated code. Focus on that value, not on building the perfect analysis system.

You're not trying to solve the entire code analysis problem - you're solving the specific problem of AI assistants needing architectural guidance.

Build something useful, then make it better. Not the other way around.
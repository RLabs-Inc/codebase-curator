# Hash Tree + Analyzer Integration 🌳

## The Power of Change Detection

Our codebase has a sophisticated hash tree system that tracks file changes efficiently. This integrates beautifully with our analyzer architecture!

## How It Works

### 1. Hash Tree Structure
```typescript
interface HashTreeNode {
  hash: string;          // Content hash
  path: string;          // File/directory path  
  type: 'file' | 'directory';
  children?: Map<string, HashTreeNode>;
}
```

### 2. Change Detection Flow

```
Initial Analysis:
1. Build complete hash tree of codebase
2. Run all analyzers on full codebase
3. Cache results with hash tree

Subsequent Analyses:
1. Build new hash tree
2. Compare with old tree - O(log n) operation!
3. Get list of changed files
4. Update ONLY affected analyzer results
```

### 3. Analyzer Integration

Each analyzer can leverage change detection:

```typescript
// DataFlowTracer
if (changedFiles.includes('src/api/user.js')) {
  // Only retrace flows involving user.js
  updateFlows(['user-registration', 'user-login']);
}

// DependencyOracle  
if (changedFiles.some(f => f.includes('package.json'))) {
  // Dependencies changed - full re-scan needed
  rebuildDependencyMap();
} else {
  // Only update importers of changed files
  updateImporters(changedFiles);
}

// PatternLibrary
changedFiles.forEach(file => {
  // Extract patterns only from changed files
  updatePatternsFor(file);
});
```

## Benefits for Curator Claude

### 1. **Instant Updates**
- "The auth flow changed 2 minutes ago when you modified login.js"
- "This analysis is current as of your last commit"

### 2. **Surgical Precision**
- Don't re-analyze 1000 files when only 3 changed
- Know exactly which insights need updating

### 3. **Historical Context**
- "This pattern was introduced in yesterday's changes"
- "The dependency graph changed when package.json was updated"

### 4. **Performance at Scale**
- 100K file codebase? No problem!
- Only analyze the 5 files that changed

## Implementation in ContextManager

The magic happens in `src/services/contextManager.ts`:

1. **buildHashTree()** - Creates hierarchical hash structure
2. **detectChangesWithHashTree()** - Finds changes in O(log n) time
3. **findChangedFiles()** - Recursively traverses only changed branches

## Example: Real-World Impact

```typescript
// Coding Claude: "How does user authentication work?"

// Without hash tree:
// - Re-analyze entire codebase (30 seconds)
// - Curator unsure what's current

// With hash tree:
// - Check hash tree: only auth.js changed (0.1 seconds)
// - Update auth-related flows only (2 seconds)
// - Curator: "Based on changes 5 minutes ago, auth now uses OAuth2..."
```

## Future Enhancements

1. **Change-Aware Analyzers**
   - Analyzers that understand the nature of changes
   - "Method renamed" vs "Logic changed"

2. **Dependency-Based Invalidation**
   - If A imports B, and B changes, mark A for re-analysis

3. **Incremental Pattern Learning**
   - Learn new patterns from changes without full re-scan

This hash tree system turns our analyzers from "batch processors" into "incremental updaters" - exactly what Curator Claude needs to provide real-time, accurate guidance!
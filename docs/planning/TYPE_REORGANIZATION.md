# Type Reorganization Plan

## Current State: Types are scattered everywhere! 🤯

### semantic-core package has:
- `types.ts` (root) - Core semantic types (SemanticInfo, CrossReference, etc.)
- `types/core.ts` - WRONG! Contains curator service types that don't belong here
- `types/config.ts` - Semantic indexing configuration
- `types/story.ts` - Story extraction types
- Types scattered in implementation files (FlowNode, HashNode, etc.)

### Problems:
1. **Duplicate types** between semantic-core and shared/types
2. **Mixed concerns** - Service types mixed with semantic analysis types  
3. **Scattered definitions** - Types defined in implementation files
4. **Unclear boundaries** - What belongs to the package vs shared?

## Proposed Organization

### Phase 1: Clean up semantic-core types

```
src/packages/semantic-core/src/types/
├── index.ts          # Barrel export
├── semantic.ts       # Core semantic types (from current types.ts)
├── config.ts         # Keep as-is (semantic indexing config)
├── story.ts          # Keep as-is (story extraction)
├── flow.ts           # Flow tracing types (from FlowTracer.ts)
├── indexing.ts       # Indexing types (from HashTree, IncrementalIndexer, etc.)
└── groups.ts         # Concept group types (from ConceptGroups.ts)
```

### Phase 2: Move types to proper locations

**Remove from semantic-core:**
- `types/core.ts` - These curator service types belong in shared/types

**Extract from implementation files:**
```typescript
// From FlowTracer.ts → types/flow.ts
export interface FlowNode { ... }
export interface FlowPath { ... }

// From HashTree.ts → types/indexing.ts
export interface HashNode { ... }
export interface HashTreeDiff { ... }

// From IncrementalIndexer.ts → types/indexing.ts
export interface IndexingStatus { ... }

// From CodebaseStreamer.ts → types/indexing.ts
export interface StreamBatch { ... }
export interface StreamOptions { ... }

// From ConceptGroups.ts → types/groups.ts
export interface ConceptGroupDefinition { ... }
export interface ConceptGroupsConfig { ... }
```

### Phase 3: Update imports

1. Update semantic-core's index.ts:
```typescript
// Remove the wrong export
// export * from './types/core'  ❌

// Add organized exports
export * from './types/semantic'
export * from './types/config'
export * from './types/story'
export * from './types/flow'
export * from './types/indexing'
export * from './types/groups'
```

2. Update all imports in implementation files to use the new type locations

### Phase 4: Organize other packages similarly

Apply the same pattern to other areas:
- Services should have their types co-located
- Tools can have UI-specific types locally
- Shared types should be truly shared across packages

## Benefits

1. **Clear package boundaries** - semantic-core is self-contained
2. **Better discoverability** - All types in one place
3. **Easier maintenance** - No hunting for type definitions
4. **Proper encapsulation** - Package internals stay internal
5. **Clean imports** - `import { SemanticInfo } from '@codebase-curator/semantic-core/types'`

## Implementation Order

1. Create new type files in semantic-core/src/types/
2. Move types from implementation files to type files
3. Delete the wrongly placed types/core.ts
4. Update all imports
5. Test that everything still compiles
6. Apply same pattern to other packages/services
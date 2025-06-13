# Codebase Curator - Type Organization Refactoring Plan

## Current State Analysis

### 1. Type Organization Issues

#### Duplication
- **Core types** are duplicated in:
  - `/src/shared/types/core.ts` 
  - `/src/packages/semantic-core/src/types/core.ts`
  - Both files are identical, causing confusion

#### Scattered Types
- Types are defined in 20+ different files across the codebase
- No clear ownership or organization pattern
- Mix of:
  - Shared types (should be reusable)
  - Package-specific types (for distribution)
  - Implementation details (local interfaces)

#### Import Inconsistencies
- Some imports use `.js` extension, others don't
- Relative paths (`../../shared/types`) make refactoring difficult
- No barrel exports for easy importing

### 2. Proposed Architecture

```
src/
├── types/                    # All shared types
│   ├── index.ts             # Barrel export
│   ├── core.ts              # Core service interfaces
│   ├── api.ts               # MCP API types
│   ├── domain/              # Domain-specific types
│   │   ├── curator.ts       # Curator-related types
│   │   ├── semantic.ts      # Semantic analysis types
│   │   ├── session.ts       # Session types
│   │   └── monitoring.ts    # Monitoring types
│   └── config.ts            # Configuration types
│
├── packages/
│   └── semantic-core/
│       ├── src/
│       │   ├── types/       # Package-specific types only
│       │   │   ├── index.ts # Public API types
│       │   │   ├── story.ts # Story extraction types
│       │   │   └── internal.ts # Internal types
│       │   └── ...
│       └── package.json
│
├── services/                 # Services use shared types
│   ├── curator/             # No type definitions here
│   └── session/             # No type definitions here
│
└── tools/                   # Tools use shared types
    ├── smartgrep/           # UI-specific types stay local
    └── monitor/             # UI-specific types stay local
```

## Refactoring Steps

### Phase 1: Consolidate Core Types (Priority: HIGH)

1. **Remove duplication**
   ```bash
   # Delete duplicate file
   rm src/packages/semantic-core/src/types/core.ts
   
   # Update imports in semantic-core to use shared types
   # FROM: import { CoreService } from './types/core'
   # TO:   import { CoreService } from '@/types/core'
   ```

2. **Create type registry** in `src/types/index.ts`:
   ```typescript
   // Core exports
   export * from './core'
   export * from './api'
   export * from './config'
   
   // Domain exports
   export * from './domain/curator'
   export * from './domain/semantic'
   export * from './domain/session'
   export * from './domain/monitoring'
   ```

### Phase 2: Migrate Scattered Types (Priority: HIGH)

1. **Move session types**:
   - FROM: `src/services/session/SessionService.ts` (Session, SessionHistoryEntry)
   - TO: `src/types/domain/session.ts`

2. **Move curator types**:
   - FROM: `src/services/curator/CuratorProcessService.ts` (CuratorProcessConfig)
   - TO: `src/types/domain/curator.ts`

3. **Move semantic types**:
   - FROM: `src/packages/semantic-core/src/types.ts`
   - TO: `src/types/domain/semantic.ts`
   - Keep only package-specific types in semantic-core

### Phase 3: Establish Import Patterns (Priority: MEDIUM)

1. **Configure TypeScript paths** in `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/types/*": ["./src/types/*"],
         "@/services/*": ["./src/services/*"],
         "@curator/semantic-core": ["./src/packages/semantic-core/src/index.ts"]
       }
     }
   }
   ```

2. **Update all imports**:
   ```typescript
   // Before
   import { CoreService } from '../../shared/types/core.js'
   
   // After
   import { CoreService } from '@/types/core'
   ```

### Phase 4: Package-Specific Organization (Priority: MEDIUM)

1. **Semantic-core package types**:
   - Keep only types that are part of the public API
   - Internal implementation types stay in their files
   - Export public types through package.json exports

2. **Create clear boundaries**:
   - `src/packages/semantic-core/src/types/index.ts` - Public API
   - `src/packages/semantic-core/src/types/internal.ts` - Internal types

### Phase 5: Documentation & Enforcement (Priority: LOW)

1. **Create type guidelines**:
   ```markdown
   # Type Definition Guidelines
   
   1. Shared types go in src/types/
   2. Package API types go in package/src/types/
   3. Local implementation details stay in their files
   4. All types must be exported through barrel files
   5. Use @/types/* imports for shared types
   ```

2. **Add linting rules**:
   - No type definitions in service files
   - No relative imports for types
   - Enforce consistent naming patterns

## Benefits

1. **Cleaner architecture**: Clear separation of concerns
2. **Easier navigation**: Developers know where to find types
3. **Better reusability**: Shared types are actually shared
4. **Simpler imports**: No more `../../` paths
5. **Package clarity**: Clear API boundaries for distribution
6. **Faster development**: Less time searching for types

## Migration Checklist

- [ ] Phase 1: Consolidate core types
- [ ] Phase 2: Migrate scattered types  
- [ ] Phase 3: Establish import patterns
- [ ] Phase 4: Package-specific organization
- [ ] Phase 5: Documentation & enforcement

## Potential Issues & Solutions

1. **Breaking changes**: Use gradual migration with compatibility exports
2. **Import updates**: Use codemod or search-replace
3. **Package dependencies**: Ensure semantic-core remains standalone
4. **Type conflicts**: Namespace types appropriately

This refactoring will make the codebase significantly more maintainable and approachable for new contributors.
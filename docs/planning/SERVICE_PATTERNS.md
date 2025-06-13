# Service Patterns Guide

## Current Service Structure

We have two main services that follow the CoreService pattern:
1. **CuratorService** - Main orchestration service
2. **SessionService** - Session management service

Both properly implement the `CoreService` interface from `shared/types/core`.

## CoreService Interface

```typescript
export interface CoreService {
  /** Initialize the service */
  initialize?(): Promise<void>

  /** Cleanup resources */
  cleanup?(): Promise<void>

  /** Get service status */
  getStatus?(): ServiceStatus | Promise<ServiceStatus>
}
```

## Service Pattern Requirements

### 1. Implementation Pattern
```typescript
export class MyService implements CoreService {
  // Private state
  private initialized = false
  
  // Constructor with optional configuration
  constructor(options: MyServiceOptions = {}) {
    // Initialize with defaults
  }
  
  // CoreService methods
  async initialize(): Promise<void> {
    if (this.initialized) return
    // Initialize resources
    this.initialized = true
  }
  
  async cleanup(): Promise<void> {
    // Cleanup resources
    this.initialized = false
  }
  
  getStatus(): ServiceStatus {
    return {
      ready: this.initialized,
      // Additional status info
    }
  }
}
```

### 2. Type Organization
- Service-specific types should be in `shared/types/` if used by multiple services
- Internal implementation types can stay in the service file
- Options interfaces should be in shared types

### 3. Error Handling
- Services should handle errors gracefully
- Use descriptive error messages
- Log errors appropriately (console.error for MCP context)

### 4. Initialization Pattern
- Services should be lazy-initialized
- Use the `initialize()` method for async setup
- Check if already initialized to prevent duplicate setup

## Current Service Analysis

### ✅ CuratorService
- Properly implements CoreService
- Has initialize() and cleanup() methods
- Returns proper ServiceStatus
- Well-organized with clear responsibilities

### ✅ SessionService  
- Properly implements CoreService
- Has initialize() method
- Returns proper ServiceStatus
- Could benefit from adding cleanup() method

## Recommendations

### 1. Add Missing Methods
SessionService should add a cleanup() method for consistency:
```typescript
async cleanup(): Promise<void> {
  // Clear in-memory sessions
  this.sessions.clear()
}
```

### 2. Consistent Status Reporting
Both services should return comprehensive status including:
- Ready state
- Resource usage
- Active connections/sessions
- Any relevant metrics

### 3. Error Handling Consistency
Ensure all services:
- Catch and log errors appropriately
- Return meaningful error states in status
- Don't throw in status methods

### 4. Documentation
Each service should have:
- Clear JSDoc comments
- Usage examples
- Error scenarios documented

## Next Steps

1. Add cleanup() to SessionService
2. Enhance status reporting in both services
3. Document error handling patterns
4. Consider creating a BaseService class for common functionality
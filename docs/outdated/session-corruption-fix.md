# Session Corruption Fix

## Problem Analysis

The session corruption occurs because of a mismatch between two different session systems:

1. **SessionService Sessions**: Complex session objects stored in `~/.codebase-curator/sessions/`
   - Used for tracking curator metadata (questions asked, tools used, etc.)
   - Has its own ID format: `timestamp-randomstring`

2. **Claude CLI Sessions**: Simple session IDs stored in `projectPath/.curator/session.txt`
   - Used by Claude CLI for conversation continuity
   - Has Claude's session ID format from the CLI output

## The Corruption Flow

1. CuratorService creates a SessionService session
2. CuratorProcessService runs Claude CLI and gets a Claude session ID
3. The Claude session ID is saved to `session.txt` 
4. On next call, we try to use SessionService session ID with Claude CLI
5. Claude CLI fails because it doesn't recognize the session ID format

## Solution

Keep the two session systems separate but coordinated:

1. **SessionService** - Continue using for metadata tracking
2. **Claude CLI Sessions** - Store separately and use only for Claude CLI

## Implementation Fix

The fix is already partially implemented! Looking at the code:
- `CuratorProcessService` correctly extracts Claude's session ID from output
- It saves this to `session.txt` independently
- The problem is in `CuratorService.askCurator()` where it passes SessionService ID to Claude

### Fix in CuratorService.ts

```typescript
// Line 159 - Remove this line that passes wrong session ID
// curatorQuery.sessionId = session.id

// The CuratorProcessService will handle its own session management
```

That's it! The systems are already mostly separate. We just need to stop passing the SessionService session ID to the CuratorProcessService.
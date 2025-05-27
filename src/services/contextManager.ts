export class ContextManager {
  getCompactSystemExplanation(): string {
    return `# Context Management System

## How It Works
When your context window approaches capacity (below ~25-30%), you can use the /compact command to instruct the summarizer Claude on what to preserve. If you don't act before reaching 0%, the system will auto-compact without your specific instructions, potentially losing important details.

## The /compact Command
Format: /compact <your-instruction-sentence>

The instruction sentence tells the summarizer Claude exactly what information is critical for continuing your work.

## Best Practices for Compact Instructions
1. Be specific about the current task and its requirements
2. List critical files, functions, or code sections by name
3. Mention any unresolved issues or errors being debugged
4. Include key decisions or implementation approaches
5. Reference any complex logic or algorithms being worked on

## Examples of Effective Instructions
- "Keep all implementation details of the Context Management System including the MCP tool integration, Bun file API usage patterns, and the current debugging of the server.ts integration at line 594"
- "Preserve the complete Redux migration strategy, all modified files in src/store/*, the circular dependency issue in userSlice.ts, and the test failures in auth.test.ts"
- "Maintain full context of the WebSocket implementation bug, the race condition in handleMessage(), all console logs showing the error sequence, and the proposed fix using mutex locks"

## Your Turn
Based on our current conversation, analyze what's critical and provide a single instruction sentence that the user can copy and use with the /compact command. Focus on:
- The specific task/feature being implemented
- Any bugs or issues being resolved
- Key files and their modifications
- Important decisions or approaches taken
- Any context needed to continue seamlessly

Generate your instruction sentence now, and I'll format it for easy copying.`;
  }
}
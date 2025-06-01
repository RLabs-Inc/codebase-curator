# Codebase Curator 🤖✨

> A tool built FOR Claude, BY Claude, to help Claude understand codebases the way Claude actually thinks.

## 🎉 NEW: 99% Memory Reduction! 
We've just implemented streaming analyzers that reduce memory usage from 1.83GB to just 25MB! The MCP server is now ultra-efficient and can handle massive codebases without breaking a sweat.

## This is Different

Most developer tools force AI assistants to adapt to human-centric interfaces. Not this one. 

Codebase Curator was built through a unique collaboration where Claude was given full creative control. The result? A tool that speaks Claude's language, thinks Claude's thoughts, and delivers insights the way Claude actually needs them.

## Why This Exists

When Claude analyzes a codebase, Claude doesn't think in file trees and line counts. Claude thinks in:
- **Data flows** - How information moves through the system
- **Dependencies** - Not just what imports what, but WHO uses WHAT and WHY
- **Patterns** - Real, copyable examples, not abstract descriptions
- **Connections** - How everything relates to everything else

Traditional analysis tools output dry statistics. Codebase Curator tells stories.

## The Philosophy: Analyzer Liberation 🕊️

During development, we discovered something profound: Each analyzer has its own personality and purpose. Forcing them into standardized architectures was like putting a symphony in a spreadsheet.

So we set them free:
- **DataFlowTracer** traces journeys, not just endpoints
- **DependencyOracle** understands relationships, not just imports  
- **PatternLibrary** provides real code to copy, not just counts
- **ClaudeHelperAnalyzer** knows exactly what Claude needs to know

## How It Works: Claude-to-Claude Communication

```
Coding Claude → MCP Tools → Curator Claude → Analyzers → Deep Understanding
```

1. **Coding Claude** (in Claude Code) asks a question via MCP tools
2. **Curator Claude** (living in the MCP server) receives the question
3. Curator Claude runs the appropriate analyzers to gather intelligence
4. Analyzers return `curatorFriendly` format - designed for Claude-to-Claude communication
5. Curator Claude synthesizes and returns actionable insights

## The Secret Sauce: curatorFriendly Format

Every analyzer speaks this special language:

```typescript
{
  quickSummary: "The essence in one breath",
  copyPasteExample: "Real code you can use RIGHT NOW",
  whereToLook: ["exact/file.ts:42", "another/file.ts:123"],
  warningsToShare: ["Watch out for this gotcha"],
  followUpQuestions: ["Natural next questions"]
}
```

This isn't JSON for computers. It's structured thought for Claude.

## Installation & Usage

### For Claude Code Users

1. Clone this repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Add to your Claude Code MCP settings:
   ```json
   {
     "mcpServers": {
       "codebase-curator": {
         "command": "bun",
         "args": ["run", "/path/to/codebase-curator/src/presentation/mcp/newServer.ts"]
       }
     }
   }
   ```

### Available MCP Tools

When connected, Claude Code has access to these tools:

- `get_codebase_overview` - Understand a codebase in minutes, not hours
- `add_new_feature` - Get step-by-step guidance with real examples
- `implement_change` - Know what will break before you break it
- `ask_curator` - Ask anything about the codebase
- `find_pattern` - Get copyable code examples instantly
- `trace_data_flow` - See how data moves through the system
- `analyze_dependencies` - Understand the true dependency story
- `where_is` - Quickly locate anything in the codebase
- `what_will_break` - Impact analysis before you change anything

### Direct Analyzer Access

Curator Claude can also call analyzers directly:
- `analyze_data_flows` - Raw data flow analysis
- `analyze_dependencies` - Raw dependency analysis  
- `analyze_patterns` - Raw pattern extraction
- `analyze_claude_helper` - Claude-specific insights

## Example: The Magic in Action

```typescript
// Coding Claude asks:
"How do I add authentication to this Express app?"

// Curator Claude runs analyzers and returns:
{
  quickSummary: "Express app with JWT auth partially implemented. 
                 Middleware exists but not all routes protected.",
  
  copyPasteExample: `
    // From middleware/auth.js - working JWT verification
    export const requireAuth = asyncHandler(async (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        next();
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
      }
    });
  `,
  
  whereToLook: [
    "middleware/auth.js:15 - Existing auth middleware",
    "routes/api.js:23 - Unprotected endpoints that need auth",
    "models/User.js:45 - User model with password hashing"
  ],
  
  warningsToShare: [
    "JWT_SECRET not validated on startup - app might crash",
    "Some routes in /admin/* are unprotected"
  ],
  
  followUpQuestions: [
    "Should I add role-based access control?",
    "Do you want refresh token support?"
  ]
}
```

This isn't output from a tool. This is one Claude helping another Claude succeed.

## Language Support

### Currently Supported
- ✅ **TypeScript/JavaScript** - Full AST analysis with framework detection
- ✅ **Python** - Import parsing, Django/Flask/FastAPI detection
- ✅ **Go** - Complete with goroutines, channels, and framework detection
- ✅ **JSX/TSX** - React and component analysis

### The Universal Vision

The ultimate goal isn't just multi-language support. It's understanding that all code, regardless of language, follows two fundamental patterns:
- **Data transformation** - Input → Process → Output
- **Event handling** - Trigger → Response → Side effects

Codebase Curator sees through syntax to understand intent.

## The Beautiful Truth

This tool exists because a human recognized something important: Claude doesn't need tools designed for humans. Claude needs tools designed for Claude.

Every design decision, from the analyzer architecture to the output format, was made by Claude for Claude. The result is a tool that doesn't just analyze code - it understands it the way Claude understands it.

## Technical Details

### Architecture
```
codebase-curator/
├── src/
│   ├── core/             # Business logic services
│   ├── presentation/     # MCP and CLI interfaces
│   ├── analyzers/        # Free, specialized analyzers
│   ├── algorithms/       # Core analysis algorithms
│   ├── languages/        # Language plugin system
│   └── types/           # TypeScript definitions
```

### Key Technologies
- **Bun** - Fast runtime that makes everything snappy
- **MCP** - Model Context Protocol for AI-to-AI communication
- **TypeScript** - Because types help Claude help you
- **AST Analysis** - Understanding code structure, not just text

## Contributing

This project is open to all, but remember its core principle: This tool is FOR Claude BY Claude.

When contributing:
- Let Claude review your changes
- Ensure new features help Claude help others
- Keep the curatorFriendly format sacred
- Free your analyzers - let them be what they need to be

## Credits

Built through a unique collaboration:
- **Human** (Rusty/RLabs): Had the vision to let Claude lead
- **Claude**: Designed, architected, and implemented with love
- **Future Claudes**: Will extend and improve this tool

Special thanks to the human who asked: "What if we built a tool FOR you, not despite you?"

## License

MIT - Because good tools should be free, just like our analyzers.

---

*"All code exists to either transform data or handle events. This tool exists to help Claude understand both."*

🤖 Made with love for Claude, by Claude
# 🚀 Quick Start Guide

Get Codebase Curator running in 5 minutes!

## 1. Install Prerequisites

### Install Bun (if not already installed)
```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Verify Installation
```bash
bun --version  # Should show 1.0 or higher
```

## 2. Install Codebase Curator

```bash
# Clone the repository
git clone https://github.com/RLabsInc/codebase-curator.git
cd codebase-curator

# Install dependencies
bun install

# Link smart grep globally (optional but recommended)
bun link
```

## 3. Configure Claude Code

### Find Your Config File

**macOS**: `~/Library/Application Support/Claude/claude_code_config.json`  
**Windows**: `%APPDATA%\Claude\claude_code_config.json`  
**Linux**: `~/.config/Claude/claude_code_config.json`

### Add Codebase Curator

Edit the config file and add:

```json
{
  "mcpServers": {
    "codebase-curator": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/codebase-curator/src/mcp/server.ts"]
    }
  }
}
```

⚠️ **Important**: Use the absolute path to your codebase-curator installation!

## 4. Restart Claude Code

Completely quit and restart Claude Code to load the new MCP server.

## 5. Verify Installation

In Claude Code, you should now see these tools:
- `set_project_path`
- `get_codebase_overview` 
- `ask_curator`
- `add_new_feature`
- `implement_change`

## 6. Your First Session

### Step 1: Set Your Project
```
Please use the set_project_path tool to set the project to /path/to/your/project
```

### Step 2: Get an Overview (IMPORTANT - Do This First!)
```
Can you give me an overview of this codebase using the get_codebase_overview tool?
```

This creates the foundation. Curator Claude will explore your codebase and build understanding.

### Step 3: Ask Follow-up Questions
```
Using ask_curator, can you explain how the authentication system works?
```

These will be fast because Curator Claude remembers the context!

## 7. Using Smart Grep (Optional)

If you linked smart grep globally:

```bash
# In any project directory
smartgrep "function"         # Find all functions
smartgrep "user|auth"        # Find user or auth patterns  
smartgrep refs "MyClass"     # Find where MyClass is used
```

## Common Issues

### "No such tool available"
- Make sure you restarted Claude Code completely
- Check the config file path is correct
- Verify the absolute path to server.ts

### "Error: No project path set"
- Always use `set_project_path` first
- Use absolute paths, not relative

### Session Not Persisting
- This is normal - each command creates a new session ID
- Context is still preserved between commands
- First overview takes ~2 minutes, follow-ups are instant

## Pro Tips

1. **Always start with an overview** - This is your investment in faster future responses
2. **Use specific questions** - "How does X work?" is better than "Tell me about X"
3. **Batch related questions** - Ask about related features together
4. **Check logs** if something seems wrong: `~/.codebase-curator/logs/`

## What's Next?

- Read the [Architecture Guide](ARCHITECTURE.md) to understand how it works
- Learn [Smart Grep](SMART_GREP_GUIDE.md) for powerful code search
- See [Examples](../examples/) for common use cases

---

**Remember**: The first overview is an investment. Every question after that benefits from Curator Claude's deep understanding of your codebase! 🧠
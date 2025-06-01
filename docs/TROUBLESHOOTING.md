# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### "bun: command not found"
You need to install Bun first:
```bash
curl -fsSL https://bun.sh/install | bash
# Then restart your terminal
```

#### "Cannot find module" errors
```bash
# Make sure you're in the codebase-curator directory
cd codebase-curator
bun install
```

### Claude Code Integration

#### "No such tool available: mcp__codebase-curator__..."
1. **Check MCP server status** in Claude Code:
   - Type `/mcp` in Claude Code
   - Look for "codebase-curator" in the list
   - Should show "connected" status

2. **Verify config file**:
   ```bash
   # macOS
   cat ~/Library/Application\ Support/Claude/claude_code_config.json
   
   # Windows
   type %APPDATA%\Claude\claude_code_config.json
   ```

3. **Common config mistakes**:
   - Using relative path instead of absolute
   - Typos in the path
   - Missing commas in JSON

4. **Correct config example**:
   ```json
   {
     "mcpServers": {
       "codebase-curator": {
         "command": "bun",
         "args": ["run", "/Users/yourname/codebase-curator/src/mcp/server.ts"]
       }
     }
   }
   ```

#### "Error: No project path set"
Always set the project path first:
```
Use set_project_path tool with path: /absolute/path/to/your/project
```

### Session Issues

#### "Session started" with new ID every time
This is **normal behavior**! Claude creates immutable sessions:
- Each command gets a new session ID
- But the conversation context is preserved
- This is how Claude CLI works

#### Overview takes too long
Normal overview times:
- Small project (<1000 files): 1-2 minutes
- Medium project (<5000 files): 2-3 minutes  
- Large project (>5000 files): 3-5 minutes

If it's taking longer:
- Check if smart grep is working: `bun run smartgrep test`
- Look for errors in logs: `~/.codebase-curator/logs/`

#### Context not preserved between questions
1. Check session file exists:
   ```bash
   cat /your/project/.curator/session.txt
   ```

2. Ensure you're using the same project path

3. Don't use `newSession: true` unless starting fresh

### Smart Grep Issues

#### "No semantic index found"
```bash
# Build index manually
cd your-project
smartgrep --build
```

#### "smartgrep: command not found"
```bash
# Link it globally from codebase-curator directory
cd codebase-curator
bun link
```

#### Results seem outdated
The index auto-updates, but you can force rebuild:
```bash
smartgrep --rebuild
```

### Performance Issues

#### Timeouts during exploration
Check the logs for which tool timed out:
```bash
tail -f ~/.codebase-curator/logs/curator-activity-*.log
```

Common causes:
- Very large files (>1MB)
- Too many files (>10,000)
- Complex file patterns

Solutions:
- Add exclusions to `.curatorconfig.json`
- Use `.gitignore` patterns

#### High memory usage
Codebase Curator streams files to avoid memory issues, but if you see problems:

1. Check for large files:
   ```bash
   find . -type f -size +1M -ls
   ```

2. Exclude them in `.curatorconfig.json`:
   ```json
   {
     "excludePatterns": [
       "*.min.js",
       "*.map",
       "dist/**",
       "build/**"
     ]
   }
   ```

### Error Messages

#### "Claude CLI not found"
1. Ensure Claude Code is installed
2. Check if claude is available:
   ```bash
   which claude
   ```

#### "Failed to spawn Claude"
Usually permissions issue:
```bash
# Make sure the script is executable
chmod +x /path/to/codebase-curator/src/mcp/server.ts
```

#### "Session corruption" warnings
This was a known issue that's been fixed. If you see it:
1. Clear the session: `rm .curator/session.txt`
2. Start fresh with overview

### Debugging Tools

#### Check MCP server logs
```bash
# See all MCP communication
tail -f ~/.codebase-curator/logs/mcp-debug.log
```

#### Check curator activity
```bash
# See what Curator Claude is doing
tail -f ~/.codebase-curator/logs/curator-activity-*.log
```

#### Enable verbose mode
In your prompts, ask for verbose output:
```
Can you give me an overview? Please be verbose about what you're doing.
```

### Platform-Specific Issues

#### macOS
- **"Operation not permitted"**: Check System Preferences > Security & Privacy
- **Slow performance**: Disable Spotlight indexing for node_modules

#### Windows
- **Path issues**: Always use forward slashes in config: `C:/Users/...`
- **Permissions**: Run as administrator if needed

#### Linux
- **Missing dependencies**: Install build tools: `sudo apt-get install build-essential`

### Getting Help

If none of these solutions work:

1. **Collect information**:
   ```bash
   bun --version
   echo $OSTYPE
   cat ~/.codebase-curator/logs/curator-activity-*.log | tail -50
   ```

2. **Check existing issues**: 
   https://github.com/RLabsInc/codebase-curator/issues

3. **Create new issue** with:
   - System information
   - Error messages
   - Steps to reproduce
   - Relevant logs

### Useful Commands

```bash
# Check if MCP server is running
ps aux | grep "mcp/server.ts"

# Clear all curator data for a project
rm -rf .curator/

# View recent errors
grep ERROR ~/.codebase-curator/logs/*.log

# Test smart grep
bun run src/semantic/cli.ts "test"
```

Remember: Most issues are configuration-related. Double-check paths and restart Claude Code completely when making changes!
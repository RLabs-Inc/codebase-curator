# Codebase Curator MCP Server

The Codebase Curator is now available as an MCP (Model Context Protocol) server, allowing Claude and other AI assistants to analyze TypeScript/JavaScript codebases directly.

## Available Tools

### 1. `get_codebase_overview`

Get a comprehensive overview of a TypeScript/JavaScript codebase.

**Parameters:**

- `path` (required): The path to the codebase to analyze

**Example:**

```json
{
  "path": "/path/to/project"
}
```

### 2. `find_similar_patterns`

Find code patterns similar to a given example in the codebase.

**Parameters:**

- `path` (required): The path to the codebase to search
- `pattern` (required): The code pattern to search for (e.g., 'useState', 'async function')
- `includeContext` (optional, default: true): Include surrounding code context
- `maxResults` (optional, default: 10): Maximum number of results to return

**Example:**

```json
{
  "path": "/path/to/project",
  "pattern": "useState",
  "includeContext": true,
  "maxResults": 5
}
```

### 3. `suggest_integration_approach`

Suggest how to integrate new code or features based on existing architectural patterns.

**Parameters:**

- `path` (required): The path to the codebase
- `featureDescription` (required): Description of the feature or code to integrate
- `featureType` (optional): Type of feature - "component", "service", "utility", "feature", or "api"

**Example:**

```json
{
  "path": "/path/to/project",
  "featureDescription": "user authentication",
  "featureType": "service"
}
```

### 4. `check_architectural_conventions`

Check if a code snippet follows the codebase's architectural conventions.

**Parameters:**

- `path` (required): The path to the codebase
- `codeSnippet` (required): The code snippet to check
- `filePath` (optional): The intended file path for the code

**Example:**

```json
{
  "path": "/path/to/project",
  "codeSnippet": "import React from 'react';\n\nclass MyComponent extends React.Component {...}",
  "filePath": "src/components/MyComponent.tsx"
}
```

## Running the MCP Server

### Standalone Mode

```bash
bun run mcp
```

### Integration with Claude Desktop

1. Add to your Claude Desktop configuration (usually at `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "codebase-curator": {
      "command": "bun",
      "args": ["run", "/path/to/codebase-claude/src/mcp/server.ts"]
    }
  }
}
```

2. Restart Claude Desktop

3. The Codebase Curator tools will be available in your Claude conversations

## Use Cases

1. **Understanding a new codebase**: Use `get_codebase_overview` to quickly understand the structure, dependencies, and patterns of a project.

2. **Finding implementation examples**: Use `find_similar_patterns` to locate existing code that implements similar functionality.

3. **Adding new features**: Use `suggest_integration_approach` to get recommendations on where and how to add new code.

4. **Code review**: Use `check_architectural_conventions` to verify that new code follows project standards.

## Development

To test the MCP server:

```bash
bun run test-mcp.ts
```

This will start the server, send initialization and tool listing requests, and verify the responses.

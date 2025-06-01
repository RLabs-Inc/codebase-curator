# Smart Grep Changelog

## Version 3.0 - Advanced Search Patterns & Enhanced Display 🎨

### Major Enhancements

#### 1. Advanced Search Patterns
- **OR Pattern (`|`)**: Search for any of multiple terms
  ```bash
  smartgrep "addCrossReference|getReferences|getImpactAnalysis"
  ```
- **AND Pattern (`&`)**: Must contain all terms
  ```bash
  smartgrep "error&handler&async"
  ```
- **NOT Pattern (`!`)**: Exclude results
  ```bash
  smartgrep "!test" --type function
  ```
- **Regex Pattern**: Full regex support
  ```bash
  smartgrep "/add.*Reference/" --regex
  ```

#### 2. Enhanced Information Display
- **Full Context**: Shows 2-3 surrounding lines for every result
- **Related Terms**: Displays other identifiers found nearby
- **Exact Positions**: Now shows line:column (was just line)
- **Function Signatures**: Complete signatures with parameters
- **Cross-Reference Context**: Shows actual code making the reference

#### 3. New Search Modes
- `--exact`: Exact match only (no fuzzy matching)
- `--regex`: Treat query as regex pattern
- `--no-context`: Hide surrounding code for cleaner view
- `--sort <by>`: Sort by relevance, usage, name, or file
- `--json`: JSON output for machine processing
- `--compact`: One line per result

#### 4. Improved Type Filtering
- Support for multiple types: `--type function,class,string`
- All types now searchable: function, class, variable, constant, string, comment, import

#### 5. Better Output Formatting
```
📁 FUNCTION (1)
├── authenticateUser (12 uses)     → auth/service.ts:34:16
│   export async function authenticateUser(email: string, password: string): Promise<User>
│   ┌─ Context:
│   │ // Validates user credentials against database
│   │ export async function authenticateUser(email: string, password: string): Promise<User> {
│   │   const user = await User.findByEmail(email);
│   📎 Related: User, findByEmail, validatePassword, createToken
│   
│   📍 Used 12 times:
│   1. routes/auth.ts:25 (call)
│      const user = await authenticateUser(req.body.email, req.body.password);
│   2. middleware/auth.ts:15 (call)
│      const authenticated = await authenticateUser(email, password);
│   3. tests/auth.test.ts:45 (call)
│      expect(await authenticateUser('test@example.com', 'password')).toBeTruthy();
│      ... and 9 more
```

### Why This Matters

**For Curator Claude**:
- No more falling back to traditional grep for OR patterns
- One search provides complete understanding
- All collected data is now displayed and useful

**For Developers**:
- Powerful search combinations
- Rich context without opening files
- Machine-readable output for tooling

### Performance

- Search patterns add minimal overhead (<5ms)
- Enhanced display uses already-indexed data
- No additional indexing required

## Version 2.0 - Cross-Reference Tracking 🚀

### New Features

#### 1. Cross-Reference Index
- Tracks where functions, classes, and other code elements are used
- Bidirectional linking between definitions and usages
- Support for multiple reference types:
  - Function calls
  - Class instantiations
  - Inheritance (extends)
  - Imports
  - Type references (coming soon)

#### 2. Enhanced Search Results
- **Usage Counts**: See how many times each result is referenced
  ```
  authenticateUser (12 uses) → auth/service.ts:34
  ```
- **Sample Usage Locations**: Shows up to 3 places where the code is used
  ```
  Used in:
  • routes/auth.ts:25 (call)
  • middleware/auth.ts:15 (call)
  • tests/auth.test.ts:45 (call)
  ```

#### 3. Impact Analysis Command
- New `smartgrep refs <term>` command shows all references
- Grouped by file and reference type
- Essential for understanding code dependencies

#### 4. Extended Concept Groups
Added new architectural and organizational groups:
- `service` - Service classes and patterns
- `flow` - Data flow and streaming
- `architecture` - Architectural patterns
- `import` - Module dependencies
- `interface` - Type definitions
- `state` - State management
- `event` - Event handling
- `logging` - Logging and debugging
- `security` - Security patterns
- `build` - Build tools
- `deploy` - Deployment configs

### Performance Impact

The cross-reference tracking increases index size by ~30% but provides:
- 10x faster "find usages" compared to grep
- Complete impact analysis in milliseconds
- Better code understanding for AI assistants

### How It Helps Curator Claude

Before:
```
Claude: *searches for function* → *finds definition*
Claude: *searches again for usages* → *many grep calls*
Claude: *tries to piece together how it's used*
```

After:
```
Claude: *searches for function* → Gets definition + usage count + examples!
Claude: *understands immediately how it's used*
```

This dramatically reduces the number of tool calls and cognitive load!

## Version 1.0 - Initial Release

- Basic semantic indexing
- TypeScript/JavaScript support
- Concept groups (auth, api, error, etc.)
- Type filtering
- File pattern filtering
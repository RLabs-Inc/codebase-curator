# Codebase Cleanup Plan

## Current Issues

### 1. Root Directory Clutter
The root directory contains files that should be organized:
- Demo scripts (`demo-*.sh`) - 3 tracked files
- Test files (`test-*.ts`) - 2 tracked files
- Test fixtures (`test-files/`) - directory with test data
- Multiple markdown docs that could be organized

### 2. Git-Tracked Files in Root (Current State)
```
.curatorconfig.example.json
.gitignore
ASCII_ART_VISION.md
CLAUDE.md
CONTRIBUTING.md
INSTALL.md
LICENSE
README.md
demo-compact-mode.sh        # Should move to examples/
demo-flow-tracer.sh         # Should move to examples/
demo-smartgrep-improvements.sh  # Should move to examples/
package.json
test-curator.ts             # Should move to tests/
test-devmarkers.ts          # Should move to tests/
tsconfig.json
```

Note: `docs/libraries/` is already in .gitignore and used for reference only.

### 3. Proposed Structure

```
codebase-curator/
├── .github/              # GitHub specific files
├── src/                  # All source code
├── tests/                # All test files
├── examples/             # Demo scripts and examples
├── docs/                 # Documentation only
├── scripts/              # Build and utility scripts
├── package.json          # Root package config
├── tsconfig.json         # TypeScript config
├── README.md             # Main readme
├── LICENSE               # License file
├── CHANGELOG.md          # Change log
└── .gitignore            # Git ignore rules
```

## Cleanup Actions

### Phase 1: Remove Unnecessary Files (IMMEDIATE)

```bash
# Remove external library documentation
rm -rf docs/libraries/

# Remove build artifacts from root
rm -rf charm/
rm -rf charm-tui/

# Move test files
mkdir -p tests/fixtures
mv test-*.ts tests/
mv test-files/* tests/fixtures/
rmdir test-files/

# Move demo scripts
mkdir -p examples/demos
mv demo-*.sh examples/demos/

# Move outdated docs
mkdir -p docs/archive
mv docs/outdated/* docs/archive/
rmdir docs/outdated/
```

### Phase 2: Organize Documentation (HIGH PRIORITY)

Current docs structure is good, but needs cleanup:
- Remove `libraries/` folder completely
- Move tool-specific docs to their packages
- Keep only high-level architecture docs in `/docs`

### Phase 3: Check for Unused Dependencies

```bash
# Find unused dependencies
bun pm ls

# Check which files are actually imported
smartgrep "from|import" --type import | grep -E "(charm|babel|tree-sitter)"
```

### Phase 4: Create Proper Examples Structure

```
examples/
├── demos/               # Demo scripts
│   ├── compact-mode.sh
│   ├── flow-tracer.sh
│   └── smartgrep.sh
├── integration/         # Integration examples
│   ├── with-claude.ts
│   └── with-mcp.ts
└── README.md           # Examples documentation
```

## Files to Keep in Root

Only essential files should remain:
- `package.json` - Package manifest
- `tsconfig.json` - TypeScript config
- `bun.lockb` - Lock file
- `README.md` - Main documentation
- `LICENSE` - License
- `CHANGELOG.md` - Version history (create if missing)
- `.gitignore` - Git configuration
- `CONTRIBUTING.md` - Contribution guidelines

## Estimated Impact

- **Before**: ~30+ files/folders in root
- **After**: ~10 essential files
- **Size reduction**: Remove ~100MB+ of unnecessary library docs
- **Clarity**: Clear, professional structure

## Benefits

1. **First Impressions**: Clean root = professional project
2. **Navigation**: Developers immediately understand structure
3. **Performance**: Faster clones, smaller repo size
4. **Maintenance**: Easier to find and update files
5. **CI/CD**: Faster builds without unnecessary files

## Checklist

- [ ] Backup current state (just in case)
- [ ] Remove `docs/libraries/` completely
- [ ] Move test files to `tests/`
- [ ] Move demos to `examples/`
- [ ] Remove build artifacts from root
- [ ] Update import paths if needed
- [ ] Update documentation references
- [ ] Verify everything still works
- [ ] Update .gitignore if needed
- [ ] Commit with clear message

This cleanup will make the project much more approachable and professional!
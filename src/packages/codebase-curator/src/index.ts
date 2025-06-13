#!/usr/bin/env bun
/**
 * Codebase Curator package entry point
 * This re-exports from the tools directory using workspace resolution
 */

// In a Bun workspace, we can directly import from the root
import '../../../tools/codebase-curator/cli.ts';
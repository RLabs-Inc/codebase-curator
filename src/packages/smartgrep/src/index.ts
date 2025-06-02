#!/usr/bin/env bun
/**
 * SmartGrep package entry point
 * This re-exports from the tools directory using workspace resolution
 */

// In a Bun workspace, we can directly import from the root
import '../../../tools/smartgrep/cli.ts';
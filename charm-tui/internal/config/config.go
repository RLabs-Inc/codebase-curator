package config

import (
	"os"
	"path/filepath"
)

// GetSmartgrepPath returns the path to the smartgrep CLI
func GetSmartgrepPath() string {
	// Check for environment variable first (for custom installations)
	if path := os.Getenv("SMARTGREP_CLI_PATH"); path != "" {
		return path
	}
	
	// Check if we're in development mode (running from charm-tui/build/bin)
	if execPath, err := os.Executable(); err == nil {
		// Check if TypeScript version exists relative to executable
		dir := filepath.Dir(execPath)
		
		// Development paths (when running from build/bin/)
		devPaths := []string{
			filepath.Join(dir, "..", "..", "..", "..", "src", "tools", "smartgrep", "cli.ts"),
			filepath.Join(dir, "..", "..", "src", "tools", "smartgrep", "cli.ts"),
		}
		
		for _, path := range devPaths {
			if _, err := os.Stat(path); err == nil {
				return path
			}
		}
	}
	
	// In production, assume smartgrep is in PATH
	return "smartgrep"
}

// GetCuratorPath returns the path to the curator CLI
func GetCuratorPath() string {
	// Check for environment variable first
	if path := os.Getenv("CURATOR_CLI_PATH"); path != "" {
		return path
	}
	
	// Check if we're in development mode
	if execPath, err := os.Executable(); err == nil {
		dir := filepath.Dir(execPath)
		
		devPaths := []string{
			filepath.Join(dir, "..", "..", "..", "..", "src", "tools", "curator-cli", "cli.ts"),
			filepath.Join(dir, "..", "..", "src", "tools", "curator-cli", "cli.ts"),
		}
		
		for _, path := range devPaths {
			if _, err := os.Stat(path); err == nil {
				return path
			}
		}
	}
	
	// In production, assume curator is in PATH
	return "curator"
}

// GetMonitorPath returns the path to the monitor CLI
func GetMonitorPath() string {
	// Check for environment variable first
	if path := os.Getenv("MONITOR_CLI_PATH"); path != "" {
		return path
	}
	
	// Check if we're in development mode
	if execPath, err := os.Executable(); err == nil {
		dir := filepath.Dir(execPath)
		
		devPaths := []string{
			filepath.Join(dir, "..", "..", "..", "..", "src", "tools", "monitor", "cli.ts"),
			filepath.Join(dir, "..", "..", "src", "tools", "monitor", "cli.ts"),
		}
		
		for _, path := range devPaths {
			if _, err := os.Stat(path); err == nil {
				return path
			}
		}
	}
	
	// In production, assume monitor is in PATH
	return "monitor"
}

// IsDevMode returns true if running in development mode (with .ts files)
func IsDevMode() bool {
	// Check if any of the TypeScript files exist
	if execPath, err := os.Executable(); err == nil {
		dir := filepath.Dir(execPath)
		devPath := filepath.Join(dir, "..", "..", "..", "..", "src", "tools", "smartgrep", "cli.ts")
		if _, err := os.Stat(devPath); err == nil {
			return true
		}
	}
	return false
}

// GetExecutor returns the command executor (bun for dev, direct for prod)
func GetExecutor() string {
	if IsDevMode() {
		return "bun"
	}
	return ""
}
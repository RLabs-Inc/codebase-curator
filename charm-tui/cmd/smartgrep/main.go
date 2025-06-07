package main

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/RLabs-Inc/codebase-curator/charm-tui/internal/config"
	"github.com/RLabs-Inc/codebase-curator/charm-tui/internal/smartgrep"
	"github.com/spf13/cobra"
)

var (
	tuiMode     bool
	typeFilter  string
	maxResults  int
	sortBy      string
	compactMode bool
	rebuildIndex bool
)

var rootCmd = &cobra.Command{
	Use:   "smartgrep [pattern]",
	Short: "Semantic code search optimized for Claude",
	Long: `SmartGrep - Beautiful semantic search for codebases
	
By default, smartgrep runs in CLI mode for maximum Claude productivity.
Use --tui for an interactive terminal interface.`,
	Args: cobra.ArbitraryArgs,  // Allow any number of arguments
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			// Launch TUI mode
			return smartgrep.RunTUI()
		}

		// CLI mode - direct passthrough to TypeScript smartgrep
		return runCLIMode(args)
	},
}

func init() {
	rootCmd.Flags().BoolVar(&tuiMode, "tui", false, "Launch interactive TUI mode")
	rootCmd.Flags().StringVar(&typeFilter, "type", "", "Filter by type (function,class,variable,etc)")
	rootCmd.Flags().IntVar(&maxResults, "max", 50, "Maximum results to show")
	rootCmd.Flags().StringVar(&sortBy, "sort", "relevance", "Sort by: relevance, usage, name, file")
	rootCmd.Flags().BoolVar(&compactMode, "compact", false, "Compact output format")
	rootCmd.Flags().BoolVar(&rebuildIndex, "index", false, "Rebuild the semantic index")
}

// Helper to execute CLI commands
func executeCommand(subcommand string, args []string, flags map[string]interface{}) error {
	executor := config.GetExecutor()
	cliPath := config.GetSmartgrepPath()
	
	var cmd *exec.Cmd
	var cmdArgs []string
	
	if executor != "" {
		// Development mode: bun run path/to/cli.ts
		cmdArgs = []string{"run", cliPath}
		if subcommand != "" {
			cmdArgs = append(cmdArgs, subcommand)
		}
		cmdArgs = append(cmdArgs, args...)
		
		// Add flags
		for flag, value := range flags {
			if boolVal, ok := value.(bool); ok && boolVal {
				cmdArgs = append(cmdArgs, "--"+flag)
			} else if strVal, ok := value.(string); ok && strVal != "" {
				cmdArgs = append(cmdArgs, "--"+flag, strVal)
			} else if intVal, ok := value.(int); ok && flag == "max" && intVal != 50 {
				cmdArgs = append(cmdArgs, "--"+flag, fmt.Sprintf("%d", intVal))
			}
		}
		
		cmd = exec.Command(executor, cmdArgs...)
	} else {
		// Production mode: smartgrep binary is in PATH
		if subcommand != "" {
			cmdArgs = append(cmdArgs, subcommand)
		}
		cmdArgs = append(cmdArgs, args...)
		
		// Add flags
		for flag, value := range flags {
			if boolVal, ok := value.(bool); ok && boolVal {
				cmdArgs = append(cmdArgs, "--"+flag)
			} else if strVal, ok := value.(string); ok && strVal != "" {
				cmdArgs = append(cmdArgs, "--"+flag, strVal)
			} else if intVal, ok := value.(int); ok && flag == "max" && intVal != 50 {
				cmdArgs = append(cmdArgs, "--"+flag, fmt.Sprintf("%d", intVal))
			}
		}
		
		cmd = exec.Command(cliPath, cmdArgs...)
	}
	
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	
	return cmd.Run()
}

func runCLIMode(args []string) error {
	// Build flags map
	flags := make(map[string]interface{})
	if rebuildIndex {
		flags["index"] = true
	}
	if typeFilter != "" {
		flags["type"] = typeFilter
	}
	if maxResults != 50 {
		flags["max"] = maxResults
	}
	if sortBy != "relevance" {
		flags["sort"] = sortBy
	}
	if compactMode {
		flags["compact"] = true
	}
	
	return executeCommand("", args, flags)
}

// Subcommands
var groupCmd = &cobra.Command{
	Use:   "group [action] [name]",
	Short: "Manage concept groups",
	Long:  "List, search, add, or remove concept groups for semantic search",
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			return smartgrep.RunGroupTUI()
		}
		
		// Pass through to TypeScript implementation
		return executeCommand("group", args, nil)
	},
}

var refsCmd = &cobra.Command{
	Use:   "refs [symbol]",
	Short: "Find all references to a symbol",
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			return smartgrep.RunRefsTUI()
		}
		
		if len(args) == 0 {
			return fmt.Errorf("symbol name required")
		}
		
		// Pass through to TypeScript implementation
		return executeCommand("refs", args, nil)
	},
}

var changesCmd = &cobra.Command{
	Use:   "changes",
	Short: "Analyze impact of uncommitted changes",
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			return smartgrep.RunChangesTUI()
		}
		
		// Pass through to TypeScript implementation
		flags := make(map[string]interface{})
		if compactMode {
			flags["compact"] = true
		}
		return executeCommand("changes", nil, flags)
	},
}

func main() {
	// Add subcommands
	rootCmd.AddCommand(groupCmd)
	rootCmd.AddCommand(refsCmd)
	rootCmd.AddCommand(changesCmd)
	
	// Add --tui flag to all subcommands
	for _, cmd := range []*cobra.Command{groupCmd, refsCmd, changesCmd} {
		cmd.Flags().BoolVar(&tuiMode, "tui", false, "Launch interactive TUI mode")
	}
	
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
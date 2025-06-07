package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

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

func runCLIMode(args []string) error {
	// Build command to run TypeScript smartgrep
	smartgrepPath := "../../src/tools/smartgrep/cli.ts"
	
	// Start with base command
	cmdArgs := []string{"run", smartgrepPath}
	
	// Check if rebuilding index
	if rebuildIndex {
		cmdArgs = append(cmdArgs, "--index")
		// Execute and pass through output
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		return cmd.Run()
	}
	
	// Add pattern if provided
	if len(args) > 0 {
		cmdArgs = append(cmdArgs, args[0])
	}
	
	// Add flags
	if typeFilter != "" {
		cmdArgs = append(cmdArgs, "--type", typeFilter)
	}
	if maxResults != 50 {
		cmdArgs = append(cmdArgs, "--max", fmt.Sprintf("%d", maxResults))
	}
	if sortBy != "relevance" {
		cmdArgs = append(cmdArgs, "--sort", sortBy)
	}
	if compactMode {
		cmdArgs = append(cmdArgs, "--compact")
	}
	
	// Execute and pass through output
	cmd := exec.Command("bun", cmdArgs...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	
	return cmd.Run()
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
		cmdArgs := []string{"run", "../../src/tools/smartgrep/cli.ts", "group"}
		cmdArgs = append(cmdArgs, args...)
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
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
		cmdArgs := []string{"run", "../../src/tools/smartgrep/cli.ts", "refs", args[0]}
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
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
		cmdArgs := []string{"run", "../../src/tools/smartgrep/cli.ts", "changes"}
		if compactMode {
			cmdArgs = append(cmdArgs, "--compact")
		}
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
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
package main

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/RLabs-Inc/codebase-curator/charm-tui/internal/monitor"
	"github.com/spf13/cobra"
)

var (
	tuiMode      bool
	withOverview bool
)

var rootCmd = &cobra.Command{
	Use:   "monitor [command]",
	Short: "Live codebase monitoring dashboard",
	Long: `Monitor - Beautiful real-time codebase monitoring
	
By default, monitor runs in CLI mode.
Use --tui for an interactive terminal interface with live updates.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			// Launch TUI dashboard
			return monitor.RunTUI()
		}
		
		// CLI mode - show help
		return cmd.Help()
	},
}

var watchCmd = &cobra.Command{
	Use:   "watch",
	Short: "Start live file monitoring",
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			return monitor.RunWatchTUI(withOverview)
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/monitor/cli.ts", "watch"}
		if withOverview {
			cmdArgs = append(cmdArgs, "--overview")
		}
		
		execCmd := exec.Command("bun", cmdArgs...)
		execCmd.Stdout = os.Stdout
		execCmd.Stderr = os.Stderr
		execCmd.Stdin = os.Stdin
		
		return execCmd.Run()
	},
}

var overviewCmd = &cobra.Command{
	Use:   "overview",
	Short: "Show static codebase overview",
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			return monitor.RunOverviewTUI()
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/monitor/cli.ts", "overview"}
		
		execCmd := exec.Command("bun", cmdArgs...)
		execCmd.Stdout = os.Stdout
		execCmd.Stderr = os.Stderr
		execCmd.Stdin = os.Stdin
		
		return execCmd.Run()
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check index status and health",
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			return monitor.RunStatusTUI()
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/monitor/cli.ts", "status"}
		
		execCmd := exec.Command("bun", cmdArgs...)
		execCmd.Stdout = os.Stdout
		execCmd.Stderr = os.Stderr
		execCmd.Stdin = os.Stdin
		
		return execCmd.Run()
	},
}

func init() {
	// Root flags
	rootCmd.PersistentFlags().BoolVar(&tuiMode, "tui", false, "Launch interactive TUI mode")
	
	// Watch flags
	watchCmd.Flags().BoolVar(&withOverview, "overview", false, "Include codebase overview in dashboard")
	
	// Add subcommands
	rootCmd.AddCommand(watchCmd)
	rootCmd.AddCommand(overviewCmd)
	rootCmd.AddCommand(statusCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
package main

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/RLabs-Inc/codebase-curator/charm-tui/internal/curator"
	"github.com/spf13/cobra"
)

var (
	tuiMode    bool
	newSession bool
	projectPath string
)

var rootCmd = &cobra.Command{
	Use:   "curator [command]",
	Short: "AI-powered codebase intelligence",
	Long: `Curator - Beautiful AI assistant for understanding codebases
	
By default, curator runs in CLI mode.
Use --tui for an interactive terminal interface with beautiful markdown rendering.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if tuiMode {
			// Launch interactive TUI
			return curator.RunTUI(projectPath)
		}
		
		// CLI mode - show help
		return cmd.Help()
	},
}

var overviewCmd = &cobra.Command{
	Use:   "overview [project-path]",
	Short: "Get comprehensive codebase overview",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := projectPath
		if len(args) > 0 {
			path = args[0]
		}
		
		if tuiMode {
			return curator.RunOverviewTUI(path, newSession)
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/curator-cli/cli.ts", "overview"}
		if path != "" {
			cmdArgs = append(cmdArgs, path)
		}
		if newSession {
			cmdArgs = append(cmdArgs, "--new-session")
		}
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
	},
}

var askCmd = &cobra.Command{
	Use:   "ask [project-path] [question]",
	Short: "Ask questions about the codebase",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		var path, question string
		
		if len(args) == 1 {
			// Just question provided
			path = projectPath
			question = args[0]
		} else {
			// Path and question provided
			path = args[0]
			question = args[1]
		}
		
		if tuiMode {
			return curator.RunAskTUI(path, question)
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/curator-cli/cli.ts", "ask"}
		if path != "" {
			cmdArgs = append(cmdArgs, path)
		}
		cmdArgs = append(cmdArgs, question)
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
	},
}

var chatCmd = &cobra.Command{
	Use:   "chat [project-path]",
	Short: "Start interactive chat session",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := projectPath
		if len(args) > 0 {
			path = args[0]
		}
		
		// Chat is always interactive - launch TUI
		return curator.RunChatTUI(path)
	},
}

var featureCmd = &cobra.Command{
	Use:   "feature [project-path] [description]",
	Short: "Get implementation guidance for new features",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		var path, description string
		
		if len(args) == 1 {
			path = projectPath
			description = args[0]
		} else {
			path = args[0]
			description = args[1]
		}
		
		if tuiMode {
			return curator.RunFeatureTUI(path, description)
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/curator-cli/cli.ts", "feature"}
		if path != "" {
			cmdArgs = append(cmdArgs, path)
		}
		cmdArgs = append(cmdArgs, description)
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
	},
}

var changeCmd = &cobra.Command{
	Use:   "change [project-path] [description]",
	Short: "Understand impact and risks of changes",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		var path, description string
		
		if len(args) == 1 {
			path = projectPath
			description = args[0]
		} else {
			path = args[0]
			description = args[1]
		}
		
		if tuiMode {
			return curator.RunChangeTUI(path, description)
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/curator-cli/cli.ts", "change"}
		if path != "" {
			cmdArgs = append(cmdArgs, path)
		}
		cmdArgs = append(cmdArgs, description)
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
	},
}

var memoryCmd = &cobra.Command{
	Use:   "memory [project-path]",
	Short: "View curator's memory about the codebase",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := projectPath
		if len(args) > 0 {
			path = args[0]
		}
		
		if tuiMode {
			return curator.RunMemoryTUI(path)
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/curator-cli/cli.ts", "memory"}
		if path != "" {
			cmdArgs = append(cmdArgs, path)
		}
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
	},
}

var clearCmd = &cobra.Command{
	Use:   "clear [project-path]",
	Short: "Clear curator's memory",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := projectPath
		if len(args) > 0 {
			path = args[0]
		}
		
		// Pass through to TypeScript implementation
		cmdArgs := []string{"run", "../../src/tools/curator-cli/cli.ts", "clear"}
		if path != "" {
			cmdArgs = append(cmdArgs, path)
		}
		
		cmd := exec.Command("bun", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		
		return cmd.Run()
	},
}

func init() {
	// Global flags
	rootCmd.PersistentFlags().BoolVar(&tuiMode, "tui", false, "Launch interactive TUI mode")
	rootCmd.PersistentFlags().StringVarP(&projectPath, "project", "p", "", "Project path (defaults to current directory)")
	
	// Command-specific flags
	overviewCmd.Flags().BoolVar(&newSession, "new-session", false, "Start fresh analysis session")
	
	// Add subcommands
	rootCmd.AddCommand(overviewCmd)
	rootCmd.AddCommand(askCmd)
	rootCmd.AddCommand(chatCmd)
	rootCmd.AddCommand(featureCmd)
	rootCmd.AddCommand(changeCmd)
	rootCmd.AddCommand(memoryCmd)
	rootCmd.AddCommand(clearCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
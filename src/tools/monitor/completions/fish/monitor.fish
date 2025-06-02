# Fish completion for monitor
# Install: Place in ~/.config/fish/completions/

# Disable file completion by default
complete -c monitor -f

# Commands
complete -c monitor -n __fish_use_subcommand -a watch -d "Monitor file changes in real-time"
complete -c monitor -n __fish_use_subcommand -a monitor -d "Monitor file changes (alias for watch)"
complete -c monitor -n __fish_use_subcommand -a overview -d "Show static codebase analysis"
complete -c monitor -n __fish_use_subcommand -a status -d "Show detailed technical status"
complete -c monitor -n __fish_use_subcommand -a rebuild -d "Force rebuild the semantic index"

# Options (only available with watch/monitor commands)
complete -c monitor -n "__fish_seen_subcommand_from watch monitor" -l overview -d "Show live overview dashboard"
complete -c monitor -n "__fish_seen_subcommand_from watch monitor" -s o -d "Show live overview dashboard"

# Help option (available globally)
complete -c monitor -l help -d "Show help information"

# Directory completion for all commands
complete -c monitor -n "__fish_seen_subcommand_from watch monitor overview status rebuild" -a "(__fish_complete_directories)"

# Examples in descriptions
complete -c monitor -n __fish_use_subcommand -a "watch --overview" -d "Monitor with live dashboard"
complete -c monitor -n __fish_use_subcommand -a "overview ." -d "Analyze current directory"
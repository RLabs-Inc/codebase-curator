# Fish completion for curator (codebase-curator)
# Install: Place in ~/.config/fish/completions/

# Disable file completion by default
complete -c curator -f
complete -c codebase-curator -f

# Commands
complete -c curator -n __fish_use_subcommand -a overview -d "Get comprehensive codebase overview"
complete -c curator -n __fish_use_subcommand -a ask -d "Ask a question about the codebase"
complete -c curator -n __fish_use_subcommand -a feature -d "Get guidance for new feature"
complete -c curator -n __fish_use_subcommand -a change -d "Get action plan for changes"
complete -c curator -n __fish_use_subcommand -a chat -d "Start interactive chat session"
complete -c curator -n __fish_use_subcommand -a memory -d "Show curator's knowledge"
complete -c curator -n __fish_use_subcommand -a clear -d "Clear curator memory"

# Same completions for codebase-curator alias
complete -c codebase-curator -n __fish_use_subcommand -a overview -d "Get comprehensive codebase overview"
complete -c codebase-curator -n __fish_use_subcommand -a ask -d "Ask a question about the codebase"
complete -c codebase-curator -n __fish_use_subcommand -a feature -d "Get guidance for new feature"
complete -c codebase-curator -n __fish_use_subcommand -a change -d "Get action plan for changes"
complete -c codebase-curator -n __fish_use_subcommand -a chat -d "Start interactive chat session"
complete -c codebase-curator -n __fish_use_subcommand -a memory -d "Show curator's knowledge"
complete -c codebase-curator -n __fish_use_subcommand -a clear -d "Clear curator memory"

# Options
complete -c curator -l help -s h -d "Show help information"
complete -c curator -l output -s o -r -a "summary detailed json" -d "Output format"
complete -c curator -l new-session -d "Start fresh without previous context"
complete -c curator -l interactive -s i -d "Interactive mode for conversations"

# Directory completion for all commands
complete -c curator -n "__fish_seen_subcommand_from overview ask feature change chat memory clear" -a "(__fish_complete_directories)"

# Examples in descriptions (shown when no subcommand selected)
complete -c curator -n __fish_use_subcommand -a "ask 'How does auth work?'" -d "Example question"
complete -c curator -n __fish_use_subcommand -a "feature 'Add notifications'" -d "Example feature"
complete -c curator -n __fish_use_subcommand -a "chat --new-session" -d "Start fresh chat"

# Output format descriptions
complete -c curator -n "__fish_seen_subcommand_from overview ask feature change" -l output -r -a summary -d "Concise overview (default)"
complete -c curator -n "__fish_seen_subcommand_from overview ask feature change" -l output -r -a detailed -d "Comprehensive analysis"
complete -c curator -n "__fish_seen_subcommand_from overview ask feature change" -l output -r -a json -d "Machine-readable format"

# Special option for chat command
complete -c curator -n "__fish_seen_subcommand_from chat" -l new-session -d "Start a fresh chat session"
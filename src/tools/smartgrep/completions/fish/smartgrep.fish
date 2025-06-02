# Fish completion for smartgrep
# Install: Place in ~/.config/fish/completions/

# Disable file completion by default
complete -c smartgrep -f

# Commands
complete -c smartgrep -n __fish_use_subcommand -a group -d "Search using a concept group"
complete -c smartgrep -n __fish_use_subcommand -a index -d "Rebuild the semantic index"
complete -c smartgrep -n __fish_use_subcommand -a refs -d "Show where a term is referenced"
complete -c smartgrep -n __fish_use_subcommand -a references -d "Show where a term is referenced"

# Concept groups (only after 'group' command)
set -l groups auth database cache api error user payment config test async service flow architecture import interface state event logging security build deploy

for group in $groups
    complete -c smartgrep -n "__fish_seen_subcommand_from group; and not __fish_seen_subcommand_from $groups" -a $group
end

# Group descriptions
complete -c smartgrep -n "__fish_seen_subcommand_from group; and not __fish_seen_subcommand_from $groups" \
    -a "auth" -d "Authentication & security patterns" \
    -a "database" -d "Database patterns (query, model, repository)" \
    -a "cache" -d "Caching patterns" \
    -a "api" -d "API patterns (endpoint, route, controller)" \
    -a "error" -d "Error handling patterns" \
    -a "user" -d "User & account patterns" \
    -a "payment" -d "Payment & billing patterns" \
    -a "config" -d "Configuration patterns" \
    -a "test" -d "Testing patterns" \
    -a "async" -d "Async & concurrency patterns" \
    -a "service" -d "Service classes and patterns" \
    -a "flow" -d "Data flow and streaming" \
    -a "architecture" -d "Architecture patterns" \
    -a "import" -d "Import/export patterns" \
    -a "interface" -d "Interface & type patterns" \
    -a "state" -d "State management patterns" \
    -a "event" -d "Event handling patterns" \
    -a "logging" -d "Logging patterns" \
    -a "security" -d "Security patterns" \
    -a "build" -d "Build & compilation patterns" \
    -a "deploy" -d "Deployment patterns"

# Options
complete -c smartgrep -l help -d "Show help information"
complete -c smartgrep -l list-groups -d "Show all available concept groups"
complete -c smartgrep -l type -r -d "Filter by type (function,class,variable,string,comment,import)"
complete -c smartgrep -l file -r -d "Filter by file patterns"
complete -c smartgrep -l max -r -a "10 20 50 100" -d "Maximum results to show"
complete -c smartgrep -l exact -d "Exact match only"
complete -c smartgrep -l regex -d "Treat query as regex pattern"
complete -c smartgrep -l no-context -d "Hide surrounding context"
complete -c smartgrep -l sort -r -a "relevance usage name file" -d "Sort results by"
complete -c smartgrep -l json -d "Output as JSON"
complete -c smartgrep -l compact -d "Compact output format"

# Type value completions
complete -c smartgrep -l type -a "function" -d "Functions"
complete -c smartgrep -l type -a "class" -d "Classes"
complete -c smartgrep -l type -a "variable" -d "Variables"
complete -c smartgrep -l type -a "string" -d "String literals"
complete -c smartgrep -l type -a "comment" -d "Comments"
complete -c smartgrep -l type -a "import" -d "Imports"

# Sort value completions
complete -c smartgrep -l sort -a "relevance" -d "Sort by relevance"
complete -c smartgrep -l sort -a "usage" -d "Sort by usage count"
complete -c smartgrep -l sort -a "name" -d "Sort by name"
complete -c smartgrep -l sort -a "file" -d "Sort by file path"
# Installing SmartGrep Shell Completions and Man Page

## Quick Install (All Shells)

Run the install script from the project root:
```bash
./tools/install.sh smartgrep
```

## Manual Installation

### Bash Completion

```bash
# Option 1: User-specific installation
mkdir -p ~/.bash_completion.d
cp src/tools/smartgrep/completions/bash/smartgrep ~/.bash_completion.d/
echo "source ~/.bash_completion.d/smartgrep" >> ~/.bashrc

# Option 2: System-wide installation (requires sudo)
sudo cp src/tools/smartgrep/completions/bash/smartgrep /etc/bash_completion.d/
```

### Zsh Completion

```bash
# Option 1: User-specific installation
mkdir -p ~/.zsh/completions
cp src/tools/smartgrep/completions/zsh/_smartgrep ~/.zsh/completions/
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc

# Option 2: System-wide installation (requires sudo)
sudo cp src/tools/smartgrep/completions/zsh/_smartgrep /usr/local/share/zsh/site-functions/
```

### Fish Completion

```bash
# User-specific installation (recommended for Fish)
mkdir -p ~/.config/fish/completions
cp src/tools/smartgrep/completions/fish/smartgrep.fish ~/.config/fish/completions/
```

### Man Page

```bash
# Option 1: User-specific installation
mkdir -p ~/man/man1
cp src/tools/smartgrep/man/smartgrep.1 ~/man/man1/
echo 'export MANPATH="$HOME/man:$MANPATH"' >> ~/.bashrc  # or ~/.zshrc

# Option 2: System-wide installation (requires sudo)
sudo cp src/tools/smartgrep/man/smartgrep.1 /usr/local/share/man/man1/
sudo mandb  # Update man database
```

## Testing Installation

### Test Completions
```bash
# Restart your shell or source your RC file
source ~/.bashrc  # or ~/.zshrc

# Test tab completion
smartgrep <TAB>              # Should show commands and options
smartgrep group <TAB>        # Should show concept groups
smartgrep --type <TAB>       # Should show type options
```

### Test Man Page
```bash
man smartgrep                # Should display the manual
```

## Features

Once installed, you'll have:

1. **Tab Completion**
   - Commands: `group`, `index`, `refs`, `references`
   - All 20+ concept groups
   - Options with descriptions
   - Type and sort values

2. **Man Page**
   - Full documentation
   - Examples and use cases
   - Concept group descriptions
   - Available via `man smartgrep`

## Uninstalling

To remove completions and man page:

```bash
# Bash
rm ~/.bash_completion.d/smartgrep

# Zsh
rm ~/.zsh/completions/_smartgrep

# Fish
rm ~/.config/fish/completions/smartgrep.fish

# Man page
rm ~/man/man1/smartgrep.1
```
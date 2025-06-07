package smartgrep

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Styles
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("212")).
			MarginBottom(1)
			
	selectedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("120"))
			
	headerStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("33"))
)

// Key bindings
type keyMap struct {
	Up     key.Binding
	Down   key.Binding
	Select key.Binding
	Back   key.Binding
	Quit   key.Binding
}

var keys = keyMap{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "down"),
	),
	Select: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "select"),
	),
	Back: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "back"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q", "ctrl+c"),
		key.WithHelp("q", "quit"),
	),
}

// Main menu item
type menuItem struct {
	title       string
	description string
	action      string
}

func (i menuItem) Title() string       { return i.title }
func (i menuItem) Description() string { return i.description }
func (i menuItem) FilterValue() string { return i.title }

// Main model
type model struct {
	mode        string
	mainMenu    list.Model
	searchInput textinput.Model
	results     string
	err         error
}

func initialModel() model {
	// Main menu items
	items := []list.Item{
		menuItem{
			title:       "🔍 Pattern Search",
			description: "Search for specific terms with AND/OR/NOT logic",
			action:      "pattern",
		},
		menuItem{
			title:       "📦 Concept Groups",
			description: "Search predefined semantic groups",
			action:      "group",
		},
		menuItem{
			title:       "🔗 Find References",
			description: "Find all usages of a symbol",
			action:      "refs",
		},
		menuItem{
			title:       "📊 Analyze Changes",
			description: "Impact analysis of uncommitted changes",
			action:      "changes",
		},
		menuItem{
			title:       "🤖 Claude Batch Mode",
			description: "Comprehensive multi-search for exploration",
			action:      "claude",
		},
	}
	
	// Create list
	mainMenu := list.New(items, list.NewDefaultDelegate(), 0, 0)
	mainMenu.Title = "SmartGrep - Semantic Search"
	mainMenu.SetShowStatusBar(false)
	mainMenu.SetFilteringEnabled(false)
	
	// Search input
	searchInput := textinput.New()
	searchInput.Placeholder = "Enter search pattern..."
	searchInput.CharLimit = 200
	searchInput.Width = 50
	
	return model{
		mode:        "menu",
		mainMenu:    mainMenu,
		searchInput: searchInput,
		results:     "",
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.mainMenu.SetWidth(msg.Width)
		m.mainMenu.SetHeight(msg.Height - 4)
		return m, nil
		
	case tea.KeyMsg:
		switch m.mode {
		case "menu":
			switch {
			case key.Matches(msg, keys.Quit):
				return m, tea.Quit
			case key.Matches(msg, keys.Select):
				selected := m.mainMenu.SelectedItem().(menuItem)
				m.mode = selected.action
				if m.mode == "pattern" || m.mode == "refs" {
					m.searchInput.Focus()
					return m, textinput.Blink
				}
				// For other modes, execute immediately
				return m, m.executeSearch()
			}
			
		case "pattern", "refs":
			switch {
			case key.Matches(msg, keys.Back):
				m.mode = "menu"
				m.searchInput.Blur()
				m.searchInput.SetValue("")
				return m, nil
			case key.Matches(msg, keys.Quit):
				return m, tea.Quit
			case msg.Type == tea.KeyEnter:
				return m, m.executeSearch()
			}
			
		case "results":
			switch {
			case key.Matches(msg, keys.Back):
				m.mode = "menu"
				m.results = ""
				return m, nil
			case key.Matches(msg, keys.Quit):
				return m, tea.Quit
			}
		}
		
	case searchResultMsg:
		m.results = string(msg)
		m.mode = "results"
		return m, nil
		
	case errMsg:
		m.err = msg
		return m, nil
	}
	
	// Update components based on mode
	switch m.mode {
	case "menu":
		var cmd tea.Cmd
		m.mainMenu, cmd = m.mainMenu.Update(msg)
		return m, cmd
	case "pattern", "refs":
		var cmd tea.Cmd
		m.searchInput, cmd = m.searchInput.Update(msg)
		return m, cmd
	}
	
	return m, nil
}

func (m model) View() string {
	if m.err != nil {
		return fmt.Sprintf("Error: %v\n\nPress 'q' to quit.", m.err)
	}
	
	switch m.mode {
	case "menu":
		return titleStyle.Render("🔍 SmartGrep TUI") + "\n\n" + m.mainMenu.View()
		
	case "pattern":
		return titleStyle.Render("Pattern Search") + "\n\n" +
			"Enter search pattern (use | for OR, & for AND, ! for NOT):\n\n" +
			m.searchInput.View() + "\n\n" +
			"Press Enter to search, Esc to go back"
			
	case "refs":
		return titleStyle.Render("Find References") + "\n\n" +
			"Enter symbol name:\n\n" +
			m.searchInput.View() + "\n\n" +
			"Press Enter to search, Esc to go back"
			
	case "results":
		return titleStyle.Render("Search Results") + "\n\n" +
			m.results + "\n\n" +
			"Press Esc to go back, q to quit"
			
	default:
		return "Loading..."
	}
}

// Commands
type searchResultMsg string
type errMsg error

func (m model) executeSearch() tea.Cmd {
	return func() tea.Msg {
		var cmdArgs []string
		
		switch m.mode {
		case "pattern":
			if m.searchInput.Value() == "" {
				return errMsg(fmt.Errorf("search pattern required"))
			}
			cmdArgs = []string{"run", "../../src/tools/smartgrep/cli.ts", m.searchInput.Value()}
			
		case "refs":
			if m.searchInput.Value() == "" {
				return errMsg(fmt.Errorf("symbol name required"))
			}
			cmdArgs = []string{"run", "../../src/tools/smartgrep/cli.ts", "refs", m.searchInput.Value()}
			
		case "group":
			// For now, just list groups
			cmdArgs = []string{"run", "../../src/tools/smartgrep/cli.ts", "group", "list"}
			
		case "changes":
			cmdArgs = []string{"run", "../../src/tools/smartgrep/cli.ts", "changes"}
			
		case "claude":
			// Special handling for Claude batch mode
			topic := "general"
			if m.searchInput.Value() != "" {
				topic = m.searchInput.Value()
			}
			return searchResultMsg(fmt.Sprintf("Claude Batch Mode for topic: %s\n\nThis would run multiple searches and create a comprehensive report.\n(Full implementation pending)", topic))
		}
		
		// Execute command
		cmd := exec.Command("bun", cmdArgs...)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return errMsg(fmt.Errorf("command failed: %w\n%s", err, string(output)))
		}
		
		return searchResultMsg(string(output))
	}
}

// RunTUI launches the main TUI
func RunTUI() error {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	_, err := p.Run()
	return err
}

// RunGroupTUI launches group-specific TUI
func RunGroupTUI() error {
	// For now, redirect to main TUI
	return RunTUI()
}

// RunRefsTUI launches refs-specific TUI
func RunRefsTUI() error {
	// For now, redirect to main TUI
	return RunTUI()
}

// RunChangesTUI launches changes-specific TUI
func RunChangesTUI() error {
	// For now, redirect to main TUI
	return RunTUI()
}
package monitor

import (
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Styles
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("212")).
			BorderStyle(lipgloss.DoubleBorder()).
			BorderForeground(lipgloss.Color("212")).
			Padding(1, 2)
			
	statsStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("33")).
			Padding(1, 2).
			MarginTop(1)
			
	addedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("120"))
			
	modifiedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("33"))
			
	deletedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196"))
			
	headerStyle = lipgloss.NewStyle().
			Bold(true).
			Underline(true)
)

// Messages
type tickMsg time.Time
type monitorOutputMsg string
type statusMsg struct {
	filesIndexed int
	lastUpdate   time.Time
	healthy      bool
}

// Main model
type model struct {
	mode         string
	viewport     viewport.Model
	progress     progress.Model
	events       []string
	stats        statusMsg
	width        int
	height       int
	showOverview bool
	err          error
}

func initialModel(mode string, showOverview bool) model {
	vp := viewport.New(80, 20)
	prog := progress.New(progress.WithDefaultGradient())
	
	return model{
		mode:         mode,
		viewport:     vp,
		progress:     prog,
		events:       []string{},
		showOverview: showOverview,
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		tickCmd(),
		m.startMonitoring(),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m model) startMonitoring() tea.Cmd {
	return func() tea.Msg {
		switch m.mode {
		case "watch":
			// Start file watcher
			cmdArgs := []string{"run", "../../src/tools/monitor/cli.ts", "watch"}
			if m.showOverview {
				cmdArgs = append(cmdArgs, "--overview")
			}
			
			cmd := exec.Command("bun", cmdArgs...)
			output, err := cmd.CombinedOutput()
			if err != nil {
				return err
			}
			return monitorOutputMsg(string(output))
			
		case "status":
			// Get status
			cmd := exec.Command("bun", "run", "../../src/tools/monitor/cli.ts", "status")
			output, err := cmd.CombinedOutput()
			if err != nil {
				return err
			}
			
			// Parse status (simplified)
			lines := strings.Split(string(output), "\n")
			status := statusMsg{
				filesIndexed: len(lines),
				lastUpdate:   time.Now(),
				healthy:      true,
			}
			return status
			
		default:
			return nil
		}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.viewport.Width = msg.Width - 4
		m.viewport.Height = msg.Height - 10
		return m, nil
		
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		case "c":
			// Clear events
			m.events = []string{}
			return m, nil
		}
		
	case tickMsg:
		// Update every second for live monitoring
		if m.mode == "watch" {
			return m, tea.Batch(tickCmd(), m.startMonitoring())
		}
		return m, tickCmd()
		
	case monitorOutputMsg:
		// Parse and add events
		lines := strings.Split(string(msg), "\n")
		for _, line := range lines {
			if line != "" {
				m.events = append(m.events, fmt.Sprintf("[%s] %s", 
					time.Now().Format("15:04:05"), line))
			}
		}
		// Keep last 100 events
		if len(m.events) > 100 {
			m.events = m.events[len(m.events)-100:]
		}
		m.viewport.SetContent(m.renderEvents())
		return m, nil
		
	case statusMsg:
		m.stats = msg
		return m, nil
		
	case error:
		m.err = msg
		return m, nil
	}
	
	// Update viewport
	var cmd tea.Cmd
	m.viewport, cmd = m.viewport.Update(msg)
	return m, cmd
}

func (m model) renderEvents() string {
	var sb strings.Builder
	
	for _, event := range m.events {
		styled := event
		if strings.Contains(event, "added") {
			styled = addedStyle.Render(event)
		} else if strings.Contains(event, "modified") {
			styled = modifiedStyle.Render(event)
		} else if strings.Contains(event, "deleted") {
			styled = deletedStyle.Render(event)
		}
		sb.WriteString(styled + "\n")
	}
	
	return sb.String()
}

func (m model) View() string {
	if m.err != nil {
		return fmt.Sprintf("Error: %v\n\nPress 'q' to quit.", m.err)
	}
	
	// Title
	title := titleStyle.Render("📊 Monitor Dashboard")
	
	// Stats box
	stats := statsStyle.Render(fmt.Sprintf(
		"%s\n\n"+
		"Files Indexed: %d\n"+
		"Last Update: %s\n"+
		"Status: %s",
		headerStyle.Render("Statistics"),
		m.stats.filesIndexed,
		m.stats.lastUpdate.Format("15:04:05"),
		func() string {
			if m.stats.healthy {
				return addedStyle.Render("✓ Healthy")
			}
			return deletedStyle.Render("✗ Issues")
		}(),
	))
	
	// Main content
	content := m.viewport.View()
	
	// Help
	help := lipgloss.NewStyle().Faint(true).Render(
		"q: quit • c: clear • ↑/↓: scroll")
	
	// Layout
	return lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		stats,
		content,
		help,
	)
}

// RunTUI launches the main monitor TUI
func RunTUI() error {
	// Default to watch mode
	return RunWatchTUI(false)
}

// RunWatchTUI launches watch mode TUI
func RunWatchTUI(withOverview bool) error {
	p := tea.NewProgram(
		initialModel("watch", withOverview),
		tea.WithAltScreen(),
	)
	_, err := p.Run()
	return err
}

// Simple overview model
type overviewModel struct {
	viewport viewport.Model
	ready    bool
}

func (m overviewModel) Init() tea.Cmd {
	return nil
}

func (m overviewModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		if !m.ready {
			m.viewport.Width = msg.Width
			m.viewport.Height = msg.Height - 2
			m.ready = true
		}
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c", "esc":
			return m, tea.Quit
		}
	}
	
	var cmd tea.Cmd
	m.viewport, cmd = m.viewport.Update(msg)
	return m, cmd
}

func (m overviewModel) View() string {
	if !m.ready {
		return "Loading..."
	}
	return m.viewport.View() + "\n\n" + lipgloss.NewStyle().Faint(true).Render("Press q to quit")
}

// RunOverviewTUI launches overview TUI
func RunOverviewTUI() error {
	// For overview, we'll use a simpler display
	cmd := exec.Command("bun", "run", "../../src/tools/monitor/cli.ts", "overview")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return err
	}
	
	// Create a simple pager view
	vp := viewport.New(80, 30)
	vp.SetContent(string(output))
	
	p := tea.NewProgram(overviewModel{viewport: vp}, tea.WithAltScreen())
	_, err = p.Run()
	return err
}

// RunStatusTUI launches status TUI
func RunStatusTUI() error {
	p := tea.NewProgram(
		initialModel("status", false),
		tea.WithAltScreen(),
	)
	_, err := p.Run()
	return err
}
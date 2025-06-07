package curator

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

// Styles
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("212")).
			BorderStyle(lipgloss.DoubleBorder()).
			BorderForeground(lipgloss.Color("212")).
			Padding(1, 3).
			MarginBottom(1)
			
	chatStyle = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("33")).
			Padding(1, 2)
			
	userStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("120"))
			
	curatorStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("212"))
			
	helpStyle = lipgloss.NewStyle().
			Faint(true).
			MarginTop(1)
)

// Messages
type responseMsg struct {
	content string
	isError bool
}

// Model
type model struct {
	mode        string
	projectPath string
	question    string
	viewport    viewport.Model
	textarea    textarea.Model
	spinner     spinner.Model
	messages    []message
	isLoading   bool
	width       int
	height      int
	err         error
	renderer    *glamour.TermRenderer
}

type message struct {
	role    string // "user" or "curator"
	content string
}

func initialModel(mode, projectPath string) model {
	// Create markdown renderer
	renderer, _ := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(80),
	)
	
	// Create components
	vp := viewport.New(80, 20)
	ta := textarea.New()
	ta.Placeholder = "Type your message..."
	ta.CharLimit = 500
	ta.SetWidth(80)
	ta.SetHeight(4)
	ta.FocusedStyle.CursorLine = lipgloss.NewStyle()
	ta.ShowLineNumbers = false
	
	sp := spinner.New()
	sp.Spinner = spinner.Dot
	sp.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("212"))
	
	return model{
		mode:        mode,
		projectPath: projectPath,
		viewport:    vp,
		textarea:    ta,
		spinner:     sp,
		messages:    []message{},
		renderer:    renderer,
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		textarea.Blink,
		m.executeInitialCommand(),
	)
}

func (m model) executeInitialCommand() tea.Cmd {
	switch m.mode {
	case "overview":
		m.isLoading = true
		return m.runCuratorCommand("overview", m.projectPath)
	case "ask":
		if m.question != "" {
			m.isLoading = true
			m.messages = append(m.messages, message{
				role:    "user",
				content: m.question,
			})
			return m.runCuratorCommand("ask", m.projectPath, m.question)
		}
	}
	return nil
}

func (m model) runCuratorCommand(command string, args ...string) tea.Cmd {
	return func() tea.Msg {
		cmdArgs := []string{"run", "../../src/tools/curator-cli/cli.ts", command}
		cmdArgs = append(cmdArgs, args...)
		
		cmd := exec.Command("bun", cmdArgs...)
		output, err := cmd.CombinedOutput()
		
		if err != nil {
			return responseMsg{
				content: fmt.Sprintf("Error: %v\n%s", err, string(output)),
				isError: true,
			}
		}
		
		return responseMsg{
			content: string(output),
			isError: false,
		}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		
		// Update viewport size
		headerHeight := 8
		footerHeight := 8
		m.viewport.Width = msg.Width - 4
		m.viewport.Height = msg.Height - headerHeight - footerHeight
		
		// Update textarea width
		m.textarea.SetWidth(msg.Width - 4)
		
		return m, nil
		
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyCtrlC:
			return m, tea.Quit
		case tea.KeyEsc:
			if m.mode == "chat" && !m.isLoading {
				return m, tea.Quit
			}
		case tea.KeyEnter:
			if m.mode == "chat" && !m.isLoading && m.textarea.Value() != "" {
				// Send message
				userMsg := m.textarea.Value()
				m.messages = append(m.messages, message{
					role:    "user",
					content: userMsg,
				})
				m.textarea.Reset()
				m.isLoading = true
				return m, m.runCuratorCommand("ask", m.projectPath, userMsg)
			}
		}
		
	case responseMsg:
		m.isLoading = false
		
		if msg.isError {
			m.err = fmt.Errorf(msg.content)
			return m, nil
		}
		
		// Add curator response
		m.messages = append(m.messages, message{
			role:    "curator",
			content: msg.content,
		})
		
		// Update viewport
		m.updateViewport()
		
		return m, nil
		
	case spinner.TickMsg:
		if m.isLoading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
	}
	
	// Update components
	var cmds []tea.Cmd
	
	if m.mode == "chat" && !m.isLoading {
		var cmd tea.Cmd
		m.textarea, cmd = m.textarea.Update(msg)
		cmds = append(cmds, cmd)
	}
	
	var cmd tea.Cmd
	m.viewport, cmd = m.viewport.Update(msg)
	cmds = append(cmds, cmd)
	
	return m, tea.Batch(cmds...)
}

func (m *model) updateViewport() {
	var content strings.Builder
	
	for _, msg := range m.messages {
		switch msg.role {
		case "user":
			content.WriteString(userStyle.Render("🧑 You:") + "\n")
			content.WriteString(msg.content + "\n\n")
		case "curator":
			content.WriteString(curatorStyle.Render("🤖 Curator:") + "\n")
			// Render markdown
			rendered, err := m.renderer.Render(msg.content)
			if err != nil {
				content.WriteString(msg.content + "\n\n")
			} else {
				content.WriteString(rendered + "\n")
			}
		}
	}
	
	m.viewport.SetContent(content.String())
	m.viewport.GotoBottom()
}

func (m model) View() string {
	if m.err != nil {
		return fmt.Sprintf("Error: %v\n\nPress Ctrl+C to quit.", m.err)
	}
	
	// Title
	title := titleStyle.Render("🤖 Curator - AI Codebase Assistant")
	
	// Main content area
	var mainContent string
	if m.isLoading {
		mainContent = chatStyle.Render(
			m.viewport.View() + "\n\n" +
				m.spinner.View() + " Thinking...",
		)
	} else {
		mainContent = chatStyle.Render(m.viewport.View())
	}
	
	// Input area (for chat mode)
	var inputArea string
	if m.mode == "chat" && !m.isLoading {
		inputArea = m.textarea.View()
	}
	
	// Help
	var help string
	switch m.mode {
	case "chat":
		help = helpStyle.Render("Enter: send • Esc: quit • ↑/↓: scroll")
	default:
		help = helpStyle.Render("↑/↓: scroll • Ctrl+C: quit")
	}
	
	// Compose layout
	return lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		mainContent,
		inputArea,
		help,
	)
}

// Public functions for different modes

func RunTUI(projectPath string) error {
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}
	return RunChatTUI(projectPath)
}

func RunOverviewTUI(projectPath string, newSession bool) error {
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}
	
	m := initialModel("overview", projectPath)
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

func RunAskTUI(projectPath, question string) error {
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}
	
	m := initialModel("ask", projectPath)
	m.question = question
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

func RunChatTUI(projectPath string) error {
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}
	
	m := initialModel("chat", projectPath)
	m.textarea.Focus()
	
	// Add welcome message
	m.messages = append(m.messages, message{
		role:    "curator",
		content: "# Welcome to Curator Chat! 🤖\n\nI'm here to help you understand your codebase. Ask me anything about:\n\n- Code structure and architecture\n- Implementation details\n- How to add new features\n- Impact of changes\n- Best practices in your project\n\nWhat would you like to know?",
	})
	m.updateViewport()
	
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

func RunFeatureTUI(projectPath, description string) error {
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}
	
	m := initialModel("feature", projectPath)
	m.question = description
	m.isLoading = true
	
	// Add user's feature request
	m.messages = append(m.messages, message{
		role:    "user",
		content: fmt.Sprintf("Feature Request: %s", description),
	})
	
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

func RunChangeTUI(projectPath, description string) error {
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}
	
	m := initialModel("change", projectPath)
	m.question = description
	m.isLoading = true
	
	// Add user's change request
	m.messages = append(m.messages, message{
		role:    "user",
		content: fmt.Sprintf("Change Analysis: %s", description),
	})
	
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

func RunMemoryTUI(projectPath string) error {
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}
	
	m := initialModel("memory", projectPath)
	m.isLoading = true
	
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}
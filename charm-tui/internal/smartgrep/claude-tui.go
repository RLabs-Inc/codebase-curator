package smartgrep

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

// Enhanced styles for Claude-optimized display
var (
	// Title styles
	mainTitleStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("212")).
		BorderStyle(lipgloss.DoubleBorder()).
		BorderForeground(lipgloss.Color("212")).
		Padding(1, 3).
		MarginBottom(1).
		Align(lipgloss.Center)
		
	// Section styles
	sectionStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("33")).
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("33")).
		Padding(0, 2).
		MarginTop(1)
		
	// Code styles
	codeStyle = lipgloss.NewStyle().
		Background(lipgloss.Color("236")).
		Foreground(lipgloss.Color("252")).
		Padding(0, 1)
		
	signatureStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("120"))
		
	// Metadata styles
	metaStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("244")).
		Italic(true)
		
	scoreStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("220"))
		
	// Reference styles
	refCallStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("120"))
		
	refImportStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("33"))
		
	refExtendsStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("212"))
		
	// Graph styles
	graphNodeStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("212"))
		
	graphEdgeStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("244"))
)

// Enhanced result display model
type resultViewModel struct {
	results    []searchResult  // Parsed results from TypeScript
	viewport   viewport.Model
	table      table.Model
	progress   progress.Model
	width      int
	height     int
	activeView string // "list", "detail", "graph", "stats"
	selected   int
	renderer   *glamour.TermRenderer
}

type searchResult struct {
	term         string
	typ          string
	location     location
	context      string
	surrounding  []string
	related      []string
	language     string
	relevance    float64
	usageCount   int
	references   []reference
	metadata     map[string]interface{}
}

type location struct {
	file   string
	line   int
	column int
}

type reference struct {
	typ      string
	from     location
	context  string
}

func newResultViewModel() resultViewModel {
	// Create glamour renderer for markdown
	renderer, _ := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(80),
	)
	
	// Create viewport
	vp := viewport.New(80, 20)
	
	// Create progress bar
	prog := progress.New(progress.WithDefaultGradient())
	
	// Create table for list view
	columns := []table.Column{
		{Title: "🎯 Term", Width: 20},
		{Title: "📦 Type", Width: 10},
		{Title: "📍 Location", Width: 30},
		{Title: "📈 Score", Width: 8},
		{Title: "🔢 Uses", Width: 8},
	}
	
	tbl := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(15),
	)
	
	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(false)
	tbl.SetStyles(s)
	
	return resultViewModel{
		viewport:   vp,
		table:      tbl,
		progress:   prog,
		activeView: "list",
		renderer:   renderer,
	}
}

func (m resultViewModel) Init() tea.Cmd {
	return nil
}

// Ensure we implement tea.Model
var _ tea.Model = resultViewModel{}

func (m resultViewModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		
		// Update component sizes
		m.viewport.Width = msg.Width - 4
		m.viewport.Height = msg.Height - 10
		m.table.SetWidth(msg.Width - 4)
		m.table.SetHeight(msg.Height / 2)
		
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			// Cycle through views
			switch m.activeView {
			case "list":
				m.activeView = "detail"
				m.updateDetailView()
			case "detail":
				m.activeView = "graph"
				m.updateGraphView()
			case "graph":
				m.activeView = "stats"
				m.updateStatsView()
			case "stats":
				m.activeView = "list"
			}
			
		case "enter":
			if m.activeView == "list" && len(m.results) > 0 {
				m.activeView = "detail"
				m.updateDetailView()
			}
		}
	}
	
	// Update active component
	var cmd tea.Cmd
	switch m.activeView {
	case "list":
		m.table, cmd = m.table.Update(msg)
		if m.table.Cursor() != m.selected {
			m.selected = m.table.Cursor()
		}
	case "detail", "graph", "stats":
		m.viewport, cmd = m.viewport.Update(msg)
	}
	
	return m, cmd
}

func (m *resultViewModel) updateDetailView() {
	if m.selected >= len(m.results) {
		return
	}
	
	result := m.results[m.selected]
	var content strings.Builder
	
	// Title
	content.WriteString(mainTitleStyle.Render(fmt.Sprintf("🎯 %s", result.term)))
	content.WriteString("\n\n")
	
	// Location and metadata
	content.WriteString(sectionStyle.Render("📍 Location"))
	content.WriteString("\n")
	content.WriteString(fmt.Sprintf("📂 File: %s\n", result.location.file))
	content.WriteString(fmt.Sprintf("📏 Line %d, Column %d\n", result.location.line, result.location.column))
	content.WriteString(fmt.Sprintf("🔤 Language: %s\n", result.language))
	content.WriteString(scoreStyle.Render(fmt.Sprintf("📈 Relevance: %.1f%%\n", result.relevance*100)))
	content.WriteString(fmt.Sprintf("🔢 Usage Count: %d\n", result.usageCount))
	
	// Code context with syntax highlighting
	content.WriteString("\n")
	content.WriteString(sectionStyle.Render("📄 Code Context"))
	content.WriteString("\n")
	
	// Show surrounding lines
	if len(result.surrounding) > 0 {
		for i, line := range result.surrounding {
			lineNum := result.location.line - len(result.surrounding)/2 + i
			if lineNum == result.location.line {
				content.WriteString(signatureStyle.Render(fmt.Sprintf("%4d: %s\n", lineNum, line)))
			} else {
				content.WriteString(codeStyle.Render(fmt.Sprintf("%4d: %s\n", lineNum, line)))
			}
		}
	} else {
		content.WriteString(signatureStyle.Render(fmt.Sprintf("%4d: %s\n", result.location.line, result.context)))
	}
	
	// Function signature extraction
	if result.typ == "function" || result.typ == "class" {
		if sig := extractSignature(result); sig != "" {
			content.WriteString("\n")
			content.WriteString(sectionStyle.Render("🔧 Signature"))
			content.WriteString("\n")
			content.WriteString(signatureStyle.Render(sig))
			content.WriteString("\n")
		}
	}
	
	// Related terms
	if len(result.related) > 0 {
		content.WriteString("\n")
		content.WriteString(sectionStyle.Render("🔗 Related Terms"))
		content.WriteString("\n")
		content.WriteString(strings.Join(result.related, ", "))
		content.WriteString("\n")
	}
	
	// References with beautiful formatting
	if len(result.references) > 0 {
		content.WriteString("\n")
		content.WriteString(sectionStyle.Render(fmt.Sprintf("📍 All References (%d)", len(result.references))))
		content.WriteString("\n")
		
		// Group by type
		refsByType := make(map[string][]reference)
		for _, ref := range result.references {
			refsByType[ref.typ] = append(refsByType[ref.typ], ref)
		}
		
		for refType, refs := range refsByType {
			style := getRefStyle(refType)
			icon := getRefIcon(refType)
			content.WriteString(fmt.Sprintf("\n%s %s (%d):\n", icon, refType, len(refs)))
			
			for i, ref := range refs {
				if i >= 10 && len(refs) > 10 {
					content.WriteString(metaStyle.Render(fmt.Sprintf("   ... and %d more\n", len(refs)-10)))
					break
				}
				content.WriteString(style.Render(fmt.Sprintf("   %s:%d\n", ref.from.file, ref.from.line)))
				content.WriteString(codeStyle.Render(fmt.Sprintf("      %s\n", ref.context)))
			}
		}
	}
	
	// Metadata
	if len(result.metadata) > 0 {
		content.WriteString("\n")
		content.WriteString(sectionStyle.Render("📊 Metadata"))
		content.WriteString("\n")
		for key, value := range result.metadata {
			content.WriteString(fmt.Sprintf("• %s: %v\n", key, value))
		}
	}
	
	m.viewport.SetContent(content.String())
}

func (m *resultViewModel) updateGraphView() {
	var content strings.Builder
	
	content.WriteString(mainTitleStyle.Render("🕸️ Relationship Graph"))
	content.WriteString("\n\n")
	
	// Build relationship graph from results
	graph := make(map[string][]string)
	for _, result := range m.results {
		// Add related terms
		for _, related := range result.related {
			graph[result.term] = append(graph[result.term], related)
		}
		
		// Add reference relationships
		for _, ref := range result.references {
			// Extract term from context (simplified)
			parts := strings.Fields(ref.context)
			if len(parts) > 0 {
				graph[result.term] = append(graph[result.term], parts[0])
			}
		}
	}
	
	// Visualize graph with beautiful formatting
	for node, edges := range graph {
		content.WriteString(graphNodeStyle.Render(node))
		content.WriteString(graphEdgeStyle.Render(" → {"))
		
		uniqueEdges := unique(edges)
		for i, edge := range uniqueEdges {
			if i > 0 {
				content.WriteString(", ")
			}
			content.WriteString(edge)
			
			if i >= 5 && len(uniqueEdges) > 6 {
				content.WriteString(fmt.Sprintf(", ... +%d more", len(uniqueEdges)-6))
				break
			}
		}
		
		content.WriteString(graphEdgeStyle.Render("}\n"))
	}
	
	m.viewport.SetContent(content.String())
}

func (m *resultViewModel) updateStatsView() {
	var content strings.Builder
	
	content.WriteString(mainTitleStyle.Render("📊 Search Statistics"))
	content.WriteString("\n\n")
	
	// Type distribution
	typeStats := make(map[string]int)
	for _, r := range m.results {
		typeStats[r.typ]++
	}
	
	content.WriteString(sectionStyle.Render("📈 Type Distribution"))
	content.WriteString("\n")
	
	total := len(m.results)
	for typ, count := range typeStats {
		percentage := float64(count) / float64(total) * 100
		icon := getTypeIcon(typ)
		bar := renderProgressBar(percentage, 30)
		content.WriteString(fmt.Sprintf("%s %-12s %s %.1f%% (%d)\n", 
			icon, typ, bar, percentage, count))
	}
	
	// File distribution
	fileStats := make(map[string]int)
	for _, r := range m.results {
		fileStats[r.location.file]++
	}
	
	content.WriteString("\n")
	content.WriteString(sectionStyle.Render("📁 File Distribution"))
	content.WriteString("\n")
	
	// Sort and show top files
	type fileStat struct {
		file  string
		count int
	}
	var files []fileStat
	for f, c := range fileStats {
		files = append(files, fileStat{f, c})
	}
	// Simple sort by count
	for i := range files {
		for j := i + 1; j < len(files); j++ {
			if files[j].count > files[i].count {
				files[i], files[j] = files[j], files[i]
			}
		}
	}
	
	for i, fs := range files {
		if i >= 10 {
			content.WriteString(metaStyle.Render(fmt.Sprintf("\n... and %d more files", len(files)-10)))
			break
		}
		percentage := float64(fs.count) / float64(total) * 100
		bar := renderProgressBar(percentage, 20)
		content.WriteString(fmt.Sprintf("%-40s %s %.1f%% (%d)\n", 
			truncatePath(fs.file, 40), bar, percentage, fs.count))
	}
	
	// Usage statistics
	var totalUsage, maxUsage int
	var withUsage int
	for _, r := range m.results {
		if r.usageCount > 0 {
			totalUsage += r.usageCount
			withUsage++
			if r.usageCount > maxUsage {
				maxUsage = r.usageCount
			}
		}
	}
	
	if withUsage > 0 {
		content.WriteString("\n")
		content.WriteString(sectionStyle.Render("🔢 Usage Statistics"))
		content.WriteString("\n")
		avgUsage := float64(totalUsage) / float64(withUsage)
		content.WriteString(fmt.Sprintf("• Average usage: %.1f\n", avgUsage))
		content.WriteString(fmt.Sprintf("• Maximum usage: %d\n", maxUsage))
		content.WriteString(fmt.Sprintf("• Items with usage data: %d/%d\n", withUsage, total))
	}
	
	// Relevance distribution
	content.WriteString("\n")
	content.WriteString(sectionStyle.Render("📊 Relevance Distribution"))
	content.WriteString("\n")
	
	relevanceBuckets := make(map[string]int)
	for _, r := range m.results {
		bucket := fmt.Sprintf("%d-%d%%", int(r.relevance*10)*10, int(r.relevance*10)*10+10)
		relevanceBuckets[bucket]++
	}
	
	buckets := []string{"90-100%", "80-90%", "70-80%", "60-70%", "50-60%", "40-50%", "30-40%", "20-30%", "10-20%", "0-10%"}
	for _, bucket := range buckets {
		if count, ok := relevanceBuckets[bucket]; ok && count > 0 {
			percentage := float64(count) / float64(total) * 100
			bar := renderProgressBar(percentage, 20)
			content.WriteString(fmt.Sprintf("%-10s %s %.1f%% (%d)\n", bucket, bar, percentage, count))
		}
	}
	
	m.viewport.SetContent(content.String())
}

func (m resultViewModel) View() string {
	var content strings.Builder
	
	// Header
	header := lipgloss.JoinHorizontal(
		lipgloss.Center,
		tabStyle("List", m.activeView == "list"),
		tabStyle("Detail", m.activeView == "detail"),
		tabStyle("Graph", m.activeView == "graph"),
		tabStyle("Stats", m.activeView == "stats"),
	)
	
	content.WriteString(lipgloss.PlaceHorizontal(m.width, lipgloss.Center, header))
	content.WriteString("\n")
	
	// Main content
	switch m.activeView {
	case "list":
		content.WriteString(m.table.View())
	case "detail", "graph", "stats":
		content.WriteString(m.viewport.View())
	}
	
	// Footer
	footer := metaStyle.Render("Tab: switch view • Enter: details • ↑/↓: navigate • q: quit")
	content.WriteString("\n")
	content.WriteString(footer)
	
	return content.String()
}

// Helper functions

func tabStyle(label string, active bool) string {
	if active {
		return lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("212")).
			Background(lipgloss.Color("236")).
			Padding(0, 2).
			Render(label)
	}
	return lipgloss.NewStyle().
		Foreground(lipgloss.Color("244")).
		Padding(0, 2).
		Render(label)
}

func getRefStyle(refType string) lipgloss.Style {
	switch refType {
	case "call":
		return refCallStyle
	case "import":
		return refImportStyle
	case "extends", "implements":
		return refExtendsStyle
	default:
		return lipgloss.NewStyle()
	}
}

func getRefIcon(refType string) string {
	icons := map[string]string{
		"call":          "📞",
		"import":        "📥",
		"extends":       "🔄",
		"implements":    "🔧",
		"instantiation": "🏗️",
		"type-reference": "🏷️",
	}
	if icon, ok := icons[refType]; ok {
		return icon
	}
	return "🔗"
}

func getTypeIcon(typ string) string {
	icons := map[string]string{
		"function": "🔧",
		"class":    "🏛️",
		"variable": "📦",
		"constant": "🔒",
		"string":   "💬",
		"comment":  "💭",
		"import":   "📥",
		"module":   "📁",
	}
	if icon, ok := icons[typ]; ok {
		return icon
	}
	return "📄"
}

func extractSignature(result searchResult) string {
	// Extract function/class signature from context
	context := result.context
	
	if result.typ == "function" {
		// Try various function patterns
		if strings.Contains(context, "func ") {
			// Go function
			return context
		} else if strings.Contains(context, "function ") {
			// JavaScript/TypeScript
			return context
		} else if strings.Contains(context, "def ") {
			// Python
			return context
		}
	}
	
	return ""
}

func renderProgressBar(percentage float64, width int) string {
	filled := int(percentage / 100.0 * float64(width))
	if filled > width {
		filled = width
	}
	
	bar := strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
	return lipgloss.NewStyle().Foreground(lipgloss.Color("120")).Render(bar)
}

func truncatePath(path string, maxLen int) string {
	if len(path) <= maxLen {
		return path
	}
	
	parts := strings.Split(path, "/")
	if len(parts) <= 2 {
		return "..." + path[len(path)-maxLen+3:]
	}
	
	// Show first and last parts
	result := parts[0] + "/.../" + parts[len(parts)-1]
	if len(result) > maxLen {
		return "..." + parts[len(parts)-1][len(parts[len(parts)-1])-maxLen+3:]
	}
	return result
}

func unique(items []string) []string {
	seen := make(map[string]bool)
	result := []string{}
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}
	return result
}
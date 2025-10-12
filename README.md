# Oscribble

<p align="center">
  <img src="oscribble.png" alt="Oscribble Logo" width="200"/>
</p>

A brutalist task manager that transforms raw bullet-point notes into AI-analyzed, structured task lists. Built with Electron, React, and Claude AI.

<p align="center">
  <img src="screenshot.png" alt="Oscribble Interface" width="800"/>
</p>

## Features

- **Raw-to-Structured Conversion**: Write quick notes in plain text, let Claude organize them into prioritized tasks
- **Voice Input**: Hold-to-record dictation with OpenAI transcription and voice-aware Claude formatting (CMD+SHIFT+V)
- **Single-Task Formatting**: Format individual unformatted tasks with Claude (CMD+F or wrench button)
- **Context-Aware**: Mention files with `@filepath` syntax to include code context in task analysis
- **Hierarchical Tasks**: Support for subtasks with expand/collapse functionality (arrow keys)
- **Task Relationships**: Visual editor for managing task dependencies and relationships (press R)
- **Inline Task Creation**: Create new tasks directly in the list (press N)
- **Metadata Editing**: Edit deadlines, effort estimates, and tags inline (press M)
- **Keyboard-First Navigation**: Arrow keys, space bar, and extensive shortcuts for rapid task management
- **Filter Modes**: Filter by all/unchecked/critical/blocked tasks (press 1-4)
- **Priority Tracking**: Critical/Performance/Feature categorization with visual indicators
- **Dependency Detection**: Automatically flags blocked tasks and dependencies
- **Project Management**: Switch between multiple projects with `Cmd+K` quick switcher
- **Hover Actions**: Format, Edit, Copy, Delete buttons appear on task hover
- **Loading States**: Visual feedback with animated spinners during API calls
- **Brutalist Design**: Monochrome terminal aesthetic with orange accents

## Installation

### Download (Recommended)

1. Download the latest `.dmg` from [Releases](https://github.com/oscargavin/oscribble/releases)
2. Open the DMG and drag Oscribble to Applications
3. Right-click Oscribble → Open (first launch only)
4. Enter your [Anthropic API key](https://console.anthropic.com/)

### Build from Source

```bash
# Clone the repository
git clone https://github.com/oscargavin/oscribble.git
cd oscribble

# Install dependencies
npm install

# Run in development mode
npm start

# Build distributable
npm run make
```

**Requirements:**
- Node.js 18+
- npm 8+
- macOS 11+ (for .dmg builds)

## Usage

### Getting Started

1. **Create a Project**: Enter a project name and select the root directory
2. **Write Raw Notes**: Type tasks in plain text, one per line
3. **Add Context** (optional): Mention files with `@src/App.tsx` to include code context
4. **Format**: Click Format or press `Cmd+Enter` to convert to structured tasks
5. **Navigate**: Use arrow keys to select, space to toggle completion

### Keyboard Shortcuts

**Global:**
- `Cmd+K` - Quick switcher
- `Cmd+N` - Open project in new window
- `Cmd+W` - Close window

**Raw Input View:**
- `Cmd+Shift+V` - Hold to record voice input (requires OpenAI API key)

**Task View:**
- `↑/↓` - Navigate tasks
- `←/→` - Collapse/expand subtasks
- `Space` - Toggle task completion
- `N` - Create new task
- `M` - Edit metadata (deadline, estimate, tags)
- `R` - Edit relationships (dependencies)
- `Delete` - Remove task
- `Cmd+F` - Format focused task with Claude
- `Cmd+C` - Copy focused task
- `Cmd+Shift+C` - Copy all tasks
- `Cmd+L` - Clear all tasks

**Filters:**
- `1` - Show all tasks
- `2` - Show unchecked only
- `3` - Show critical only
- `4` - Show blocked only

### Task Management

**Creating Tasks:**
- Click "Edit Raw" to add multiple tasks at once, then format
- Press `N` while viewing tasks to create a single task inline
- New tasks default to "feature" priority and can be formatted individually

**Formatting Tasks:**
- **Bulk format**: Add raw tasks in "Edit Raw" view and click Format button
- **Single format**: Hover over a raw task and click the wrench icon, or press `Cmd+F`
- Tasks marked `[RAW]` need formatting; formatted tasks show priority badges

**Task Relationships:**
- Press `R` on any task to open the relationships editor
- Set dependencies using task numbers (e.g., "1, 3, 5")
- Tasks automatically show `[DEPENDS]` and `[RELATED]` metadata
- Blocked tasks are flagged automatically by Claude during formatting

**Subtasks:**
- Formatted tasks may include subtasks from Claude's analysis
- Use `←/→` arrow keys to collapse/expand subtasks
- Subtask count shown in brackets next to parent task

**Hover Actions:**
- **Wrench icon**: Format this task with Claude (raw tasks only)
- **Pencil icon**: Edit metadata (deadline, estimate, tags)
- **Copy icon**: Copy task details to clipboard
- **Trash icon**: Delete task

### Context Mentions

Reference files for AI context:

```
Fix the login bug @src/auth/login.ts
Refactor the dashboard @src/components/Dashboard.tsx
Add tests for user service @src/services/user.ts
```

Claude will read mentioned files (and their imports, up to 3 levels deep) to provide better task analysis.

## Architecture

Oscribble follows Electron's multi-process architecture:

- **Main Process** (`src/index.ts`): Window management, IPC, service orchestration
- **Renderer Process** (`src/App.tsx`): React UI
- **Preload Script** (`src/preload.ts`): Secure IPC bridge

### Services

- **StorageService**: File I/O in `~/.project-stickies/`
- **ContextService**: Parses `@mentions` and loads file context
- **ClaudeService**: Formats tasks using Claude API (Sonnet 4.5)

### Data Storage

```
~/.project-stickies/
├── settings.json         # API key, current project
├── projects.json         # Project registry
└── {project-name}/
    ├── notes.json        # Structured tasks
    └── raw.txt           # Auto-saved raw input
```

## Configuration

### API Keys

Stored locally in `~/.project-stickies/settings.json`. Never committed or shared.

**Required:**
- **Anthropic API Key**: For Claude-powered task formatting. Get from [console.anthropic.com](https://console.anthropic.com/)
- **OpenAI API Key** (optional): For voice input transcription. Get from [platform.openai.com](https://platform.openai.com/api-keys)

Voice input requires both API keys. Text-based task formatting only requires the Anthropic key.

### Claude Model

Currently uses `claude-sonnet-4-5-20250929`. To change, edit `src/services/claude.ts:56`.

## Development

```bash
# Start with DevTools open
npm start

# Lint TypeScript
npm run lint

# Package (no installers)
npm run package

# Build installers for current platform
npm run make
```

### Project Structure

```
oscribble/
├── src/
│   ├── index.ts              # Main process
│   ├── preload.ts            # IPC bridge
│   ├── renderer.tsx          # React entry point
│   ├── App.tsx               # Main app component
│   ├── components/           # UI components
│   ├── services/             # Business logic
│   └── types/                # TypeScript definitions
├── forge.config.ts           # Electron Forge config
├── webpack.*.config.ts       # Webpack configs
└── package.json
```

## MCP Integration

Interact with your Oscribble tasks through Claude Code using the MCP server:

```bash
# Install via npx (one-line setup)
# Add to ~/.claude/claude_desktop_config.json:
{
  "mcpServers": {
    "oscribble": {
      "command": "npx",
      "args": ["-y", "@oscargavin/oscribble-mcp"]
    }
  }
}
```

Then ask Claude Code:
- "Show me unchecked tasks in oscribble"
- "Complete task abc-123"
- "Add a new task to fix the login bug"

**Features:**
- List projects and tasks with filtering
- Complete/uncomplete tasks
- View task metadata (priority, blockers, notes)
- Add new tasks from Claude Code
- Works even when the Oscribble app is closed

See [`docs/mcp-integration.md`](docs/mcp-integration.md) for full documentation, or check out the [MCP server repository](https://github.com/oscargavin/oscribble-mcp).

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- AI analysis by [Claude](https://www.anthropic.com/claude) (Anthropic)
- Design inspired by brutalist and terminal aesthetics

---

**Note**: Oscribble is not affiliated with Anthropic. You need your own API key to use Claude's features.

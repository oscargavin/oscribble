# Oscribble - Project Context

## Overview

Oscribble is a brutalist task manager that transforms raw bullet-point notes into AI-analyzed, structured task lists using Claude AI. It's an Electron desktop application built with React 19, TypeScript, and Tailwind CSS.

**Version:** 1.1.0
**Platform:** macOS (primary), with cross-platform Electron foundation
**License:** MIT

## Core Features

- **AI-Powered Task Formatting**: Converts raw text to structured, prioritized tasks using Claude Sonnet 4.5
- **Voice Input**: Speech-to-text via OpenAI Whisper for hands-free task creation
- **@Mention Context**: File mentions (`@filepath`) load code context for smarter task analysis
- **Hierarchical Tasks**: Expandable/collapsible task trees with dependency tracking
- **Multi-Project Management**: Quick switching between projects (Cmd+K, Cmd+1-9)
- **Keyboard-First UX**: Arrow keys, shortcuts, minimal mouse interaction
- **File Watching**: Auto-reload tasks when external changes detected (for MCP integration)
- **MCP Server Support**: Control Oscribble from Claude Code via `@oscargavin/oscribble-mcp`

## Architecture

### Tech Stack

```
Electron 38.2.2           - Desktop app framework
React 19.2.0              - UI framework
TypeScript 4.5.4          - Type safety
Tailwind CSS 4.1.14       - Styling
@anthropic-ai/sdk 0.65.0  - Claude API integration
openai 6.3.0              - Voice transcription
Electron Forge 7.10.2     - Build tooling
Webpack 5                 - Bundling
```

### Process Architecture

```
Main Process (index.ts)
├── IPC handlers for Claude, OpenAI, storage
├── File watching (notes.json for external changes)
├── Window management (multi-window support)
└── Service initialization

Renderer Process (React App)
├── App.tsx - Main component & state orchestration
├── Components/ - UI components
├── Hooks/ - useProjects, useVoiceRecording
└── Services/ - (preload bridge to main process)

Preload (preload.ts)
└── Context bridge exposing IPC APIs to renderer
```

## Directory Structure

```
oscribble/
├── src/
│   ├── index.ts                 # Main process entry
│   ├── preload.ts               # IPC bridge
│   ├── renderer.tsx             # Renderer entry
│   ├── App.tsx                  # Main React component
│   ├── index.html               # HTML template
│   ├── index.css                # Global styles
│   │
│   ├── components/
│   │   ├── Setup.tsx            # First-run setup wizard
│   │   ├── RawInput.tsx         # Raw text editor with autosave
│   │   ├── TaskTree.tsx         # Hierarchical task view
│   │   ├── Settings.tsx         # API key management
│   │   ├── ProjectSwitcher.tsx  # Dropdown project selector
│   │   ├── QuickSwitcher.tsx    # Cmd+K fuzzy search modal
│   │   ├── FileAutocomplete.tsx # @mention autocomplete
│   │   ├── DirectoryAutocomplete.tsx # Path suggestions
│   │   └── ui/checkbox.tsx      # Radix checkbox component
│   │
│   ├── services/
│   │   ├── storage.ts           # File I/O (~/.project-stickies)
│   │   ├── claude.ts            # Claude API (task formatting)
│   │   ├── openai.ts            # OpenAI Whisper (transcription)
│   │   └── context.ts           # @mention context gathering
│   │
│   ├── hooks/
│   │   ├── useProjects.ts       # Project state management
│   │   └── useVoiceRecording.ts # MediaRecorder wrapper
│   │
│   └── types/
│       ├── index.ts             # Core types (TaskNode, NotesFile, etc.)
│       └── electron.d.ts        # Electron API type definitions
│
├── forge.config.ts              # Electron Forge build config
├── webpack.*.config.ts          # Webpack configs (main/renderer)
├── tsconfig.json                # TypeScript config
├── postcss.config.js            # Tailwind PostCSS setup
├── entitlements.mac.plist       # macOS permissions (microphone)
├── oscribble.icns               # App icon
├── package.json                 # Dependencies & scripts
└── README.md                    # User-facing docs
```

## Data Model

### Storage Location
`~/.project-stickies/`

### File Structure
```
~/.project-stickies/
├── settings.json           # Global settings
├── projects.json           # Project registry
└── {project_name}/
    ├── notes.json          # Structured TaskNode array
    ├── raw.txt             # Autosaved raw input
    └── .context-cache/     # File context cache
```

### Key Types (src/types/index.ts)

```typescript
TaskNode {
  id: string              // UUID
  text: string
  checked: boolean
  indent: number          // Nesting level
  children: TaskNode[]
  metadata?: {
    priority?: 'critical' | 'performance' | 'feature'
    depends_on?: string[] // Task dependencies (UUIDs)
    blocked_by?: string[] // Legacy - use depends_on
    related_to?: string[] // Related task UUIDs
    notes?: string[]      // Claude's analysis insights
    deadline?: string     // ISO date or human-readable
    effort_estimate?: string
    tags?: string[]
    formatted?: boolean   // True if analyzed by Claude
  }
}

NotesFile {
  version: string
  project_path: string
  last_modified: number
  tasks: TaskNode[]
  last_formatted_raw?: string  // Tracks incremental formatting
}

ProjectSettings {
  name: string
  path: string          // Project root directory
  created: number
  last_accessed: number
}

AppSettings {
  auth_method: 'api_key' | 'subscription'
  current_project?: string
  api_key?: string          // Anthropic API key
  openai_api_key?: string   // OpenAI API key (optional)
}
```

## Key Workflows

### Task Formatting Flow

1. User types raw text in `RawInput.tsx`
2. Autosave to `raw.txt` (300ms debounce)
3. User presses Cmd+Enter
4. App.tsx calls `window.electronAPI.gatherContext()` to parse `@mentions`
5. ContextService reads mentioned files (up to 10KB each, cached)
6. App.tsx calls `window.electronAPI.formatWithClaude(rawText, context)`
7. ClaudeService sends to Claude Sonnet 4.5 with system prompt
8. Response parsed into `ClaudeFormatResponse` (sections, tasks, warnings)
9. Converted to `TaskNode[]` with UUIDs
10. Appended to existing tasks, saved to `notes.json`
11. View switches to `TaskTree.tsx`

### Voice Input Flow

1. User presses Cmd+R → starts MediaRecorder (webm audio)
2. User presses Cmd+R again → stops recording
3. Audio blob converted to ArrayBuffer, sent to OpenAI Whisper
4. Transcript passed through same formatting flow (with `isVoiceInput: true` flag)
5. Claude uses lenient parsing for conversational speech

### Project Switching Flow

1. User presses Cmd+K → opens `QuickSwitcher.tsx`
2. Fuzzy search filters projects
3. Selection calls `App.handleProjectSwitch()`
4. Saves current project state
5. Updates `settings.json` with new `current_project`
6. Loads new project's `raw.txt` and `notes.json`
7. Updates `last_accessed` timestamp

### External Changes (MCP Integration)

1. Main process watches `notes.json` via `fs.watch()`
2. On change, debounced 300ms → sends IPC event `notes-file-changed`
3. Renderer receives event, reloads tasks from disk
4. If in raw view with new tasks → auto-switches to tasks view

## IPC API (preload.ts → index.ts)

All IPC methods return `{ success: boolean, data?: any, error?: string }`

**Claude & OpenAI**
- `initClaude(apiKey)`
- `initOpenAI(apiKey)`
- `formatWithClaude(rawText, context, isVoiceInput?)`
- `formatSingleTask(taskText, projectRoot)`
- `transcribeAudio(audioBuffer)`

**Storage**
- `getSettings()`, `saveSettings(settings)`
- `getProjects()`, `addProject(project)`, `updateProject(project)`, `deleteProject(name)`
- `getNotes(projectName)`, `saveNotes(projectName, notes)`
- `getRaw(projectName)`, `saveRaw(projectName, text)`

**Context & Files**
- `gatherContext(rawText, projectRoot)` - Extracts @mentions
- `getProjectFiles(projectRoot)` - File list for autocomplete (max 500)
- `getDirectorySuggestions(partialPath)` - Directory autocomplete

**Window Management**
- `openProjectWindow(projectName)` - New window for project
- `closeWindow()`

**File Watching**
- `startWatchingProject(projectName)`
- `stopWatchingProject()`
- `onNotesChanged(callback)` - Listen for external changes

## Keyboard Shortcuts

**Global**
- `Cmd+K` - Quick project switcher
- `Cmd+1-9` - Switch to project (alphabetical order)
- `Cmd+T` - Toggle raw/tasks view
- `Cmd+R` - Toggle voice recording
- `Cmd+W` - Close window
- `Cmd+N` - Open current project in new window
- `ESC` - Cancel voice recording

**Tasks View (TaskTree.tsx)**
- `↑/↓` - Navigate
- `←/→` - Collapse/expand
- `Space` - Toggle complete
- `N` - New task
- `M` - Edit metadata
- `R` - Edit dependencies
- `Delete` - Remove task
- `1-4` - Filter: all/unchecked/critical/blocked

**Raw View (RawInput.tsx)**
- `Cmd+Enter` - Format with Claude
- `@` - Trigger file autocomplete

## Claude Integration

### Model
`claude-sonnet-4-5-20250929` (Sonnet 4.5)

### System Prompt (src/services/claude.ts:4-52)
The system prompt instructs Claude to:
1. Parse tasks into categories: CRITICAL, PERFORMANCE, FEATURES
2. Identify dependencies (`depends_on`) and blockers
3. Extract deadlines, effort estimates, tags from natural language
4. Handle voice input (lenient parsing, ignore filler words)
5. Return structured JSON with arrays (not comma-separated strings)
6. Detect missing tasks based on code context

### Context Gathering (src/services/context.ts)
- Scans raw text for `@filepath` mentions
- Reads file contents (max 10KB per file)
- Caches results (7-day expiry)
- Formats as plain text context for Claude

## Development

### Commands
```bash
npm start           # Dev mode with DevTools
npm run lint        # TypeScript/ESLint check
npm run make        # Build .dmg/.zip (out/make/)
npm run package     # Package without installer (out/)
```

### Build Output
```
out/
├── make/
│   ├── Oscribble-1.1.0-arm64.dmg   # macOS installer
│   └── zip/darwin/arm64/           # Portable .zip
└── Oscribble-darwin-arm64/         # Packaged app (not zipped)
```

### macOS Permissions
Microphone permission required for voice input, defined in:
- `forge.config.ts` → `extendInfo.NSMicrophoneUsageDescription`
- `entitlements.mac.plist` → `com.apple.security.device.audio-input`

### Ad-hoc Code Signing
Development builds use ad-hoc signing (`identity: '-'`) to avoid Gatekeeper issues. For distribution, replace with Apple Developer ID.

## Component Responsibilities

### App.tsx (695 lines)
**State orchestration** for the entire app:
- View switching (setup → raw → tasks)
- Project switching & multi-window coordination
- API key initialization (Claude, OpenAI)
- Voice recording lifecycle
- Task formatting with incremental diff logic
- File watcher setup
- Keyboard shortcut handling

### TaskTree.tsx
**Hierarchical task renderer**:
- Flat array → visual tree rendering with indents
- Keyboard navigation (arrow keys, space, shortcuts)
- Inline editing (text, metadata, dependencies)
- Filtering (all/unchecked/critical/blocked)
- Drag-to-reorder (not yet implemented)

### RawInput.tsx
**Raw text editor**:
- Textarea with autosave (300ms debounce)
- `@mention` detection & autocomplete
- Cmd+Enter to format
- Preserves unsaved work

### Setup.tsx
**First-run wizard**:
- API key input (Anthropic required, OpenAI optional)
- Project creation (name + directory picker)
- Validates & initializes services

### QuickSwitcher.tsx
**Cmd+K fuzzy finder**:
- Keyboard-driven project search
- Shows recent projects first
- Supports Enter (switch) & Cmd+Enter (new window)

## Known Patterns & Conventions

### State Management
No Redux/Zustand - App.tsx holds global state, passes down as props. Hook-based for reusable logic (useProjects, useVoiceRecording).

### Styling
Tailwind with CSS variables for theming:
```css
--bg-primary: #1a1a1a        (dark gray)
--text-primary: #e5e5e5      (light gray)
--text-dim: #888888          (muted)
--accent: #FF4D00            (orange)
```

### File I/O
Always use `StorageService.atomicWrite()` (write to .tmp, then rename) to prevent corruption on crashes.

### Error Handling
IPC handlers return `{ success: boolean, error?: string }`. Renderer shows alerts on failure (not toast notifications).

## MCP Integration

Oscribble exposes MCP server at `@oscargavin/oscribble-mcp` (separate npm package).

**MCP Tools:**
- `oscribble_list_projects`
- `oscribble_list_tasks` (with status filter)
- `oscribble_complete_task`
- `oscribble_uncomplete_task`
- `oscribble_get_task_details`
- `oscribble_add_raw_task`

Claude Code can control Oscribble via natural language:
```
"Show unchecked tasks in my main project"
"Mark task abc-123 as complete"
"Add task: refactor auth module"
```

## Future Considerations

**Not Yet Implemented:**
- Drag-to-reorder tasks
- Streaming Claude responses (UI prepared, backend exists but unused)
- Task search/filtering beyond priority
- Subtask rendering (data model supports, UI doesn't)
- Undo/redo
- Export to Markdown/JSON

**Potential Issues:**
- Large task lists (1000+ tasks) may slow TaskTree rendering → virtualization needed
- No conflict resolution for simultaneous edits across windows
- Voice recording only supports WebM (macOS default) → may need format conversion for other platforms

## Development Notes

**When Adding Features:**
1. Define types in `src/types/index.ts` first
2. Add IPC handlers in `src/index.ts` (main process)
3. Expose via `preload.ts` context bridge
4. Add type definitions to `src/types/electron.d.ts`
5. Use in components via `window.electronAPI.*`

**When Modifying Storage:**
- Always update `NotesFile.version` if schema changes
- Add migration logic in `StorageService.getNotes()`
- Test with existing projects to avoid data loss

**When Testing Claude Prompts:**
- Modify `SYSTEM_PROMPT` in `src/services/claude.ts`
- Test with edge cases (voice input, @mentions, dependencies)
- Validate JSON parsing (malformed JSON crashes the app)

**When Building for Release:**
1. Bump version in `package.json`
2. Update `README.md` if user-facing changes
3. Run `npm run make`
4. Test .dmg on clean macOS install
5. Create GitHub release with changelog

## Context for AI Assistance

**When asked to add features:**
- Prefer existing patterns (hooks for reusable logic, props for data flow)
- Keep keyboard navigation in mind (Oscribble is keyboard-first)
- Add shortcuts to README if new hotkeys introduced
- Use brutalist aesthetic (minimal, functional, orange accents)

**When debugging:**
- Check DevTools console (opens automatically in dev mode)
- Inspect `~/.project-stickies/` for storage issues
- IPC errors often silent → add logging in main process handlers
- File watcher may not trigger on some editors (vim, Emacs) → test with VSCode/TextEdit

**When refactoring:**
- App.tsx is large (695 lines) but logically organized → extract state to hooks if splitting
- TaskTree.tsx performance-critical → avoid re-renders, use React.memo if needed
- StorageService is synchronous async (no caching) → add in-memory cache if performance issues

**Code Style:**
- TypeScript strict mode enabled
- ESLint rules in place (run `npm run lint`)
- React functional components, no classes
- Prefer async/await over .then()
- Error messages user-facing → keep concise

---

Last updated: 2025-10-13 (v1.1.0)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oscribble is an Electron-based desktop application that transforms raw bullet-point notes into structured, AI-analyzed task lists. It features a sticky note-style UI and integrates with Claude to intelligently organize tasks by priority, detect dependencies, and flag potential issues.

## Development Commands

- `npm start` - Start the Electron app in development mode (opens DevTools automatically)
- `npm run lint` - Run ESLint on TypeScript/TSX files
- `npm run package` - Package the app for distribution
- `npm run make` - Build distributables for the current platform

Note: Localhost is always running on port 3000 for this project.

## Architecture

### Electron Multi-Process Structure

The app follows Electron's multi-process architecture:

- **Main process** (`src/index.ts`): Manages the BrowserWindow, handles IPC communication, and orchestrates service layer
- **Renderer process** (`src/renderer.tsx`, `src/App.tsx`): React-based UI that communicates with main via IPC
- **Preload script** (`src/preload.ts`): Secure bridge exposing specific IPC channels to renderer via `contextBridge`

### Service Layer

Three core services handle business logic in the main process:

1. **StorageService** (`src/services/storage.ts`):
   - Manages all file I/O in `~/.project-stickies/` directory
   - Handles app settings, project registry, notes files, and raw text
   - Uses atomic writes (temp file + rename) to prevent corruption
   - Auto-deduplicates projects on startup

2. **ContextService** (`src/services/context.ts`):
   - Parses `@mentions` from raw text (e.g., `@src/App.tsx`)
   - Recursively loads mentioned files and their imports (max 3 levels deep, 50KB per file)
   - Builds context map for Claude to understand codebase structure
   - Limits: 10 files per mention, skips node_modules

3. **ClaudeService** (`src/services/claude.ts`):
   - Formats raw tasks using Claude API (model: `claude-sonnet-4-5-20250929`)
   - Sends raw text + file context, receives structured JSON response
   - Response includes sections (CRITICAL/PERFORMANCE/FEATURES), task dependencies, and warnings
   - Supports streaming (not yet implemented in UI)

4. **OpenAIService** (`src/services/openai.ts`):
   - Transcribes audio to text using OpenAI Whisper (model: `gpt-4o-mini-transcribe`)
   - Converts WebM audio blobs from MediaRecorder to text
   - Used for voice input feature
   - Requires separate OpenAI API key

### Data Flow

**Text Input Flow:**
1. User types raw notes in `RawInput` component with `@file/path` mentions
2. On format: `gather-context` IPC → ContextService loads mentioned files
3. `format-with-claude` IPC → ClaudeService sends to API with context
4. Claude returns structured JSON (sections/tasks/priorities/blockers)
5. App converts to `TaskNode` tree, appends to existing tasks (diff-based to avoid re-formatting)
6. Tasks saved to `~/.project-stickies/{project}/notes.json`

**Voice Input Flow:**
1. User holds microphone button or presses `CMD+SHIFT+V` to start recording
2. Browser MediaRecorder captures audio as WebM blob
3. On release: `transcribe-audio` IPC → OpenAIService transcribes audio to text
4. Transcript checked for `@mentions` → ContextService loads mentioned files
5. `format-with-claude` IPC (with `isVoiceInput=true`) → ClaudeService formats with voice-aware prompting
6. Claude receives voice flag, applies lenient parsing for conversational speech
7. Tasks appear directly in list (voice input skips diff logic, formats entire transcript)
8. Tasks saved to `~/.project-stickies/{project}/notes.json`

### Key Types

- **TaskNode** (`src/types/index.ts`): Recursive task structure with metadata (priority, blocked_by, notes)
- **NotesFile**: Persisted task state including `last_formatted_raw` for diff tracking
- **ProjectSettings**: Project registry entry (name, path, timestamps)
- **ClaudeFormatResponse**: Structured output from Claude API

### UI Components

- **Setup**: Initial onboarding flow (API key + project creation)
- **RawInput**: Textarea with autocomplete for `@mentions` (files and directories)
- **TaskTree**: Hierarchical task display with checkboxes and metadata badges
- **ProjectSwitcher**: Dropdown to switch between projects (sorted by last_accessed)
- **QuickSwitcher**: `Cmd+K` modal for fast project switching
- **Settings**: Update API key

### Autocomplete System

Two autocomplete handlers in main process:
- `get-project-files`: Scans project root (max 500 files, skips `.`, `node_modules`, `dist`, `build`, `.webpack`)
- `get-directory-suggestions`: Suggests directories for path input (expands `~`, limits to 5)

## Important Implementation Details

### Diff-Based Formatting

The app tracks `last_formatted_raw` to avoid re-processing unchanged text:
- Compares current raw text to last formatted version line-by-line
- Only sends new/changed lines to Claude
- Appends new tasks to existing list instead of replacing

This prevents duplicate tasks and reduces API calls.

### Frameless Window

The app uses a frameless, transparent Electron window (`frame: false`, `transparent: true`) with:
- Custom drag region (`.drag-region` class in header)
- Non-draggable elements (`.no-drag` class for buttons)
- Drop shadow for sticky note aesthetic

### IPC Security

All IPC handlers are in `src/index.ts`. The preload script exposes a typed API via `window.electronAPI`:
- Claude service initialized once with API key, stored in main process
- File system operations never exposed to renderer directly
- Context isolation enabled, node integration disabled

### Voice Input

Hold the microphone button (or `CMD+SHIFT+V`) to record task dictation:

**Audio Processing Pipeline:**
- Audio captured via browser MediaRecorder API (WebM format)
- OpenAI Whisper transcribes to text (`gpt-4o-mini-transcribe` model)
- Transcript sent to Claude with voice-aware prompting
- Tasks appear directly in task list

**Hold-to-Record Behavior:**
- Press and hold microphone button or `CMD+SHIFT+V` to start recording
- Red pulsing indicator shows recording is active
- Release to stop recording and begin transcription
- Processing indicator displays during transcription/formatting

**Voice-Aware Formatting:**
- Claude receives `isVoiceInput=true` flag with transcript
- Applies lenient parsing for conversational speech patterns
- Ignores filler words ("um", "uh", "like", "you know")
- Extracts discrete tasks from run-on sentences
- Converts natural language to concise task descriptions
- Example: "So um I need to like fix the login bug and then uh also we should add the dark mode"
  becomes two tasks: "Fix login bug" and "Add dark mode feature"

**Requirements:**
- Both Anthropic API key (Claude formatting) and OpenAI API key (transcription) required
- API keys configured in Settings panel
- Microphone permission required from browser
- Voice input available only in raw input view

**Technical Details:**
- Voice transcripts skip diff logic (always format full transcript)
- `@mentions` in voice transcription are supported (context gathering works)
- Uses `useVoiceRecording` hook (`src/hooks/useVoiceRecording.ts`)
- IPC handlers: `init-openai`, `transcribe-audio`

### Storage Location

All data stored in `~/.project-stickies/`:
```
~/.project-stickies/
├── settings.json         # App-wide settings (current_project, api_key, openai_api_key)
├── projects.json         # Project registry
└── {project-name}/
    ├── notes.json        # Structured tasks
    ├── raw.txt           # Autosaved raw input
    └── .context-cache/   # (Future use for caching file context)
```

## Build Configuration

- **Webpack**: Uses Electron Forge with separate main/renderer configs
- **TypeScript**: Target ES6, JSX compiled to React 19 format
- **Tailwind CSS**: v4.1.14 with PostCSS integration
- **Makers**: Builds for Windows (Squirrel), macOS (ZIP), and Linux (DEB/RPM)

## Model Selection

The app explicitly uses `claude-sonnet-4-5-20250929`. If updating the model, change it in `src/services/claude.ts:56`.

## MCP Integration

Oscribble provides an MCP (Model Context Protocol) server for Claude Code integration, allowing natural language interaction with project data.

### Available MCP Tools

The MCP server (`~/.config/oscribble-mcp/server.py`) exposes these tools:

1. **oscribble_list_projects** - List all Oscribble projects with paths and timestamps
2. **oscribble_list_tasks** - List tasks with filtering (all/checked/unchecked)
3. **oscribble_complete_task** - Mark a task as complete
4. **oscribble_uncomplete_task** - Mark a task as incomplete
5. **oscribble_get_task_details** - Get full task metadata (priority, blockers, notes)
6. **oscribble_add_raw_task** - Append raw task text to project

### Usage Examples

When working on Oscribble tasks via Claude Code:
- "Show me all high priority tasks in oscribble"
- "List unchecked tasks in [project-name]"
- "What tasks are blocked?"
- "Complete task [task-id]"
- "Add task: [description] to [project-name]"

### Data Access

The MCP server reads/writes the same `~/.project-stickies/` storage as the Electron app:
- Uses atomic writes (same pattern as StorageService) for data safety
- Works even when the Electron app is closed
- Safe for concurrent access (read-only operations while app is open)

### Documentation

See `docs/mcp-integration.md` for complete setup guide, configuration, and troubleshooting.

# Time Tracking & Few-Shot Learning System Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add task timing tracking with MCP integration and few-shot learning to improve Claude's time estimates based on completion history.

**Architecture:**
- Storage layer persists completion history in `completion_log.json`
- IPC handlers coordinate timing between main/renderer processes
- MCP servers (Python + TypeScript) expose begin/complete tools to Claude Code
- Few-shot prompt engineering uses recent completions to calibrate estimates
- UI shows pulsing indicator for active tasks (start_time && !duration)

**Tech Stack:**
- Electron IPC, TypeScript, React 19
- Python MCP server (in use) + TypeScript MCP server (npm package)
- Claude Sonnet 4.5 for few-shot learning
- Tailwind CSS for pulsing indicator animation

**Key Contracts:**

```typescript
// Data Schema
TaskNode.metadata: {
  start_time?: number   // Unix timestamp (task active if set && !duration)
  duration?: number     // Milliseconds (presence means completed)
}

CompletionLog {
  version: "1.0.0"
  completions: [{
    task_id: string
    text: string
    estimated_time?: string   // e.g., "4-6h"
    actual_time: number       // milliseconds
    completed_at: number      // Unix timestamp
  }]
}

// IPC Methods
startTaskTimer(taskId: string) → { success, start_time? }
completeTask(taskId: string) → { success, duration? }
getRecentCompletions(limit: number) → { success, completions? }

// MCP Tools (Python + TypeScript)
begin_task(project_name, task_id) → status message
complete_task(project_name, task_id) → duration + status
```

---

## Domain 1: Storage Layer

**Objective:** Add completion_log.json persistence with atomic writes and retention policy

### Task 1.1: Define CompletionLog Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add CompletionLog types**

```typescript
// Add after NotesFile interface (around line 50)

export interface CompletionEntry {
  task_id: string;
  text: string;
  estimated_time?: string;
  actual_time: number;      // milliseconds
  completed_at: number;     // Unix timestamp
}

export interface CompletionLog {
  version: string;
  completions: CompletionEntry[];
}
```

**Step 2: Add timing fields to TaskMetadata**

```typescript
// In TaskMetadata interface (around line 30)
export interface TaskMetadata {
  // ... existing fields
  start_time?: number;   // Unix timestamp
  duration?: number;     // milliseconds
}
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add CompletionLog and timing metadata"
```

### Task 1.2: Add Completion Log Storage Methods

**Files:**
- Modify: `src/services/storage.ts`

**Step 1: Add getCompletionLog method**

```typescript
// Add after getNotes method (around line 120)

export async function getCompletionLog(projectName: string): Promise<CompletionLog> {
  const projectDir = path.join(STORAGE_DIR, projectName);
  const logPath = path.join(projectDir, 'completion_log.json');

  if (!fs.existsSync(logPath)) {
    return { version: '1.0.0', completions: [] };
  }

  const content = await fs.promises.readFile(logPath, 'utf-8');
  return JSON.parse(content);
}
```

**Step 2: Add saveCompletionLog method**

```typescript
// Add after getCompletionLog

export async function saveCompletionLog(
  projectName: string,
  log: CompletionLog
): Promise<void> {
  const projectDir = path.join(STORAGE_DIR, projectName);
  const logPath = path.join(projectDir, 'completion_log.json');

  await atomicWrite(logPath, JSON.stringify(log, null, 2));
}
```

**Step 3: Add appendCompletion helper with retention**

```typescript
// Add after saveCompletionLog

const COMPLETION_RETENTION_LIMIT = 100;

export async function appendCompletion(
  projectName: string,
  entry: CompletionEntry
): Promise<void> {
  const log = await getCompletionLog(projectName);

  log.completions.push(entry);

  // Retention policy: keep last 100 completions
  if (log.completions.length > COMPLETION_RETENTION_LIMIT) {
    log.completions = log.completions.slice(-COMPLETION_RETENTION_LIMIT);
  }

  await saveCompletionLog(projectName, log);
}
```

**Step 4: Export new functions**

```typescript
// In module.exports at top of file (around line 10)
export {
  // ... existing exports
  getCompletionLog,
  saveCompletionLog,
  appendCompletion
};
```

**Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/services/storage.ts
git commit -m "feat(storage): add completion log persistence with retention"
```

---

## Domain 2: IPC & Main Process Handlers

**Objective:** Add IPC handlers for start/complete task with timing logic

### Task 2.1: Add Start Task Timer IPC Handler

**Files:**
- Modify: `src/index.ts`

**Step 1: Import storage methods**

```typescript
// In imports section (around line 15)
import {
  // ... existing imports
  appendCompletion
} from './services/storage';
```

**Step 2: Add start-task-timer IPC handler**

```typescript
// Add after format-single-task handler (around line 180)

ipcMain.handle('start-task-timer', async (_event, taskId: string) => {
  try {
    const settings = await getSettings();
    if (!settings.current_project) {
      return { success: false, error: 'No project selected' };
    }

    const notes = await getNotes(settings.current_project);
    const task = findTaskById(notes.tasks, taskId);

    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    const start_time = Date.now();

    if (!task.metadata) {
      task.metadata = {};
    }
    task.metadata.start_time = start_time;

    await saveNotes(settings.current_project, notes);

    return { success: true, start_time };
  } catch (error) {
    console.error('Error starting task timer:', error);
    return { success: false, error: String(error) };
  }
});
```

**Step 3: Add findTaskById helper**

```typescript
// Add before start-task-timer handler

function findTaskById(tasks: TaskNode[], id: string): TaskNode | null {
  for (const task of tasks) {
    if (task.id === id) return task;
    if (task.children) {
      const found = findTaskById(task.children, id);
      if (found) return found;
    }
  }
  return null;
}
```

**Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(ipc): add start-task-timer handler"
```

### Task 2.2: Add Complete Task IPC Handler

**Files:**
- Modify: `src/index.ts`

**Step 1: Add complete-task IPC handler**

```typescript
// Add after start-task-timer handler

ipcMain.handle('complete-task', async (_event, taskId: string) => {
  try {
    const settings = await getSettings();
    if (!settings.current_project) {
      return { success: false, error: 'No project selected' };
    }

    const notes = await getNotes(settings.current_project);
    const task = findTaskById(notes.tasks, taskId);

    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    if (!task.metadata?.start_time) {
      return { success: false, error: 'Task not started' };
    }

    const completed_at = Date.now();
    const duration = completed_at - task.metadata.start_time;

    task.metadata.duration = duration;

    // Append to completion log
    await appendCompletion(settings.current_project, {
      task_id: taskId,
      text: task.text,
      estimated_time: task.metadata.effort_estimate,
      actual_time: duration,
      completed_at
    });

    await saveNotes(settings.current_project, notes);

    return { success: true, duration };
  } catch (error) {
    console.error('Error completing task:', error);
    return { success: false, error: String(error) };
  }
});
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(ipc): add complete-task handler with duration tracking"
```

### Task 2.3: Add Get Recent Completions IPC Handler

**Files:**
- Modify: `src/index.ts`

**Step 1: Add get-recent-completions handler**

```typescript
// Add after complete-task handler

ipcMain.handle('get-recent-completions', async (_event, limit: number = 10) => {
  try {
    const settings = await getSettings();
    if (!settings.current_project) {
      return { success: false, error: 'No project selected' };
    }

    const log = await getCompletionLog(settings.current_project);
    const recent = log.completions.slice(-limit).reverse(); // Most recent first

    return { success: true, completions: recent };
  } catch (error) {
    console.error('Error getting recent completions:', error);
    return { success: false, error: String(error) };
  }
});
```

**Step 2: Import getCompletionLog**

```typescript
// Add to imports (around line 15)
import {
  // ... existing imports
  getCompletionLog
} from './services/storage';
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(ipc): add get-recent-completions handler"
```

### Task 2.4: Expose IPC Methods in Preload

**Files:**
- Modify: `src/preload.ts`

**Step 1: Add IPC methods to contextBridge**

```typescript
// In contextBridge.exposeInMainWorld (around line 30)
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods

  // Task timing
  startTaskTimer: (taskId: string) =>
    ipcRenderer.invoke('start-task-timer', taskId),
  completeTask: (taskId: string) =>
    ipcRenderer.invoke('complete-task', taskId),
  getRecentCompletions: (limit?: number) =>
    ipcRenderer.invoke('get-recent-completions', limit),
});
```

**Step 2: Add type definitions**

**Files:**
- Modify: `src/types/electron.d.ts`

```typescript
// In Window interface (around line 20)
interface Window {
  electronAPI: {
    // ... existing methods

    // Task timing
    startTaskTimer: (taskId: string) => Promise<{ success: boolean; start_time?: number; error?: string }>;
    completeTask: (taskId: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
    getRecentCompletions: (limit?: number) => Promise<{ success: boolean; completions?: CompletionEntry[]; error?: string }>;
  };
}
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/preload.ts src/types/electron.d.ts
git commit -m "feat(preload): expose task timing IPC methods"
```

---

## Domain 3: Python MCP Server

**Objective:** Add begin_task and complete_task tools to Python MCP server

### Task 3.1: Add Begin Task Tool to Python MCP

**Files:**
- Modify: `~/.config/oscribble-mcp/server.py`

**Step 1: Add begin_task tool handler**

```python
# Add after oscribble_uncomplete_task handler (around line 200)

@mcp.tool()
async def oscribble_begin_task(project_name: str, task_id: str) -> str:
    """Begin timing a task - records start timestamp

    Args:
        project_name: Name of the project
        task_id: UUID of the task to begin timing

    Returns:
        Status message with start time
    """
    try:
        project_dir = os.path.join(STORAGE_DIR, project_name)
        notes_path = os.path.join(project_dir, 'notes.json')

        if not os.path.exists(notes_path):
            return f"Error: Project '{project_name}' not found"

        with open(notes_path, 'r') as f:
            notes = json.load(f)

        task = find_task_by_id(notes['tasks'], task_id)
        if not task:
            return f"Error: Task '{task_id}' not found"

        start_time = int(time.time() * 1000)  # milliseconds

        if 'metadata' not in task:
            task['metadata'] = {}
        task['metadata']['start_time'] = start_time

        atomic_write(notes_path, json.dumps(notes, indent=2))

        return f"✓ Started timing task: {task['text'][:50]}... (at {start_time})"

    except Exception as e:
        return f"Error: {str(e)}"
```

**Step 2: Add time import at top**

```python
# Add to imports (around line 5)
import time
```

**Step 3: Test Python syntax**

Run: `python3 -m py_compile ~/.config/oscribble-mcp/server.py`
Expected: No errors

**Step 4: Commit**

```bash
cd ~/.config/oscribble-mcp
git add server.py
git commit -m "feat: add begin_task tool for timing"
```

### Task 3.2: Add Complete Task Tool to Python MCP

**Files:**
- Modify: `~/.config/oscribble-mcp/server.py`

**Step 1: Add complete_task tool handler**

```python
# Add after oscribble_begin_task handler

@mcp.tool()
async def oscribble_complete_task_with_timing(project_name: str, task_id: str) -> str:
    """Complete a task and calculate duration from start time

    Args:
        project_name: Name of the project
        task_id: UUID of the task to complete

    Returns:
        Status message with duration
    """
    try:
        project_dir = os.path.join(STORAGE_DIR, project_name)
        notes_path = os.path.join(project_dir, 'notes.json')
        log_path = os.path.join(project_dir, 'completion_log.json')

        if not os.path.exists(notes_path):
            return f"Error: Project '{project_name}' not found"

        with open(notes_path, 'r') as f:
            notes = json.load(f)

        task = find_task_by_id(notes['tasks'], task_id)
        if not task:
            return f"Error: Task '{task_id}' not found"

        if 'metadata' not in task or 'start_time' not in task['metadata']:
            return f"Error: Task not started (use oscribble_begin_task first)"

        completed_at = int(time.time() * 1000)
        duration = completed_at - task['metadata']['start_time']

        task['metadata']['duration'] = duration
        task['checked'] = True

        # Append to completion log
        log = {'version': '1.0.0', 'completions': []}
        if os.path.exists(log_path):
            with open(log_path, 'r') as f:
                log = json.load(f)

        log['completions'].append({
            'task_id': task_id,
            'text': task['text'],
            'estimated_time': task.get('metadata', {}).get('effort_estimate'),
            'actual_time': duration,
            'completed_at': completed_at
        })

        # Retention: keep last 100
        if len(log['completions']) > 100:
            log['completions'] = log['completions'][-100:]

        atomic_write(notes_path, json.dumps(notes, indent=2))
        atomic_write(log_path, json.dumps(log, indent=2))

        duration_hours = duration / (1000 * 60 * 60)
        return f"✓ Completed task in {duration_hours:.1f}h: {task['text'][:50]}..."

    except Exception as e:
        return f"Error: {str(e)}"
```

**Step 2: Test Python syntax**

Run: `python3 -m py_compile ~/.config/oscribble-mcp/server.py`
Expected: No errors

**Step 3: Restart MCP server**

Run: `killall python3 && sleep 1`
Note: Claude Code will auto-restart the server

**Step 4: Commit**

```bash
cd ~/.config/oscribble-mcp
git add server.py
git commit -m "feat: add complete_task_with_timing tool"
```

---

## Domain 4: TypeScript MCP Server

**Objective:** Add begin_task and complete_task tools to TypeScript MCP npm package

### Task 4.1: Add Begin Task Tool to TypeScript MCP

**Files:**
- Modify: `~/Documents/projects/oscribble-mcp/src/index.ts`

**Step 1: Add beginTask tool**

```typescript
// Add after uncompleteTask tool (find the server.setRequestHandler section)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ... existing tools
    {
      name: "oscribble_begin_task",
      description: "Begin timing a task - records start timestamp",
      inputSchema: {
        type: "object",
        properties: {
          project_name: {
            type: "string",
            description: "Name of the project",
          },
          task_id: {
            type: "string",
            description: "UUID of the task to begin timing",
          },
        },
        required: ["project_name", "task_id"],
      },
    },
  ],
}));

// Add handler in CallToolRequestSchema section
case "oscribble_begin_task": {
  const { project_name, task_id } = args;
  const projectDir = path.join(STORAGE_DIR, project_name);
  const notesPath = path.join(projectDir, 'notes.json');

  if (!fs.existsSync(notesPath)) {
    return {
      content: [{ type: "text", text: `Error: Project '${project_name}' not found` }],
    };
  }

  const notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
  const task = findTaskById(notes.tasks, task_id);

  if (!task) {
    return {
      content: [{ type: "text", text: `Error: Task '${task_id}' not found` }],
    };
  }

  const start_time = Date.now();

  if (!task.metadata) {
    task.metadata = {};
  }
  task.metadata.start_time = start_time;

  atomicWrite(notesPath, JSON.stringify(notes, null, 2));

  return {
    content: [{
      type: "text",
      text: `✓ Started timing task: ${task.text.slice(0, 50)}... (at ${start_time})`
    }],
  };
}
```

**Step 2: Build TypeScript**

Run: `cd ~/Documents/projects/oscribble-mcp && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd ~/Documents/projects/oscribble-mcp
git add src/index.ts
git commit -m "feat: add begin_task tool for timing"
```

### Task 4.2: Add Complete Task Tool to TypeScript MCP

**Files:**
- Modify: `~/Documents/projects/oscribble-mcp/src/index.ts`

**Step 1: Add completeTaskWithTiming tool definition**

```typescript
// Add to tools array in ListToolsRequestSchema
{
  name: "oscribble_complete_task_with_timing",
  description: "Complete a task and calculate duration from start time",
  inputSchema: {
    type: "object",
    properties: {
      project_name: {
        type: "string",
        description: "Name of the project",
      },
      task_id: {
        type: "string",
        description: "UUID of the task to complete",
      },
    },
    required: ["project_name", "task_id"],
  },
}
```

**Step 2: Add handler in CallToolRequestSchema**

```typescript
case "oscribble_complete_task_with_timing": {
  const { project_name, task_id } = args;
  const projectDir = path.join(STORAGE_DIR, project_name);
  const notesPath = path.join(projectDir, 'notes.json');
  const logPath = path.join(projectDir, 'completion_log.json');

  if (!fs.existsSync(notesPath)) {
    return {
      content: [{ type: "text", text: `Error: Project '${project_name}' not found` }],
    };
  }

  const notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
  const task = findTaskById(notes.tasks, task_id);

  if (!task) {
    return {
      content: [{ type: "text", text: `Error: Task '${task_id}' not found` }],
    };
  }

  if (!task.metadata?.start_time) {
    return {
      content: [{ type: "text", text: `Error: Task not started (use oscribble_begin_task first)` }],
    };
  }

  const completed_at = Date.now();
  const duration = completed_at - task.metadata.start_time;

  task.metadata.duration = duration;
  task.checked = true;

  // Load or create completion log
  let log = { version: '1.0.0', completions: [] };
  if (fs.existsSync(logPath)) {
    log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  }

  log.completions.push({
    task_id,
    text: task.text,
    estimated_time: task.metadata?.effort_estimate,
    actual_time: duration,
    completed_at
  });

  // Retention: keep last 100
  if (log.completions.length > 100) {
    log.completions = log.completions.slice(-100);
  }

  atomicWrite(notesPath, JSON.stringify(notes, null, 2));
  atomicWrite(logPath, JSON.stringify(log, null, 2));

  const duration_hours = duration / (1000 * 60 * 60);

  return {
    content: [{
      type: "text",
      text: `✓ Completed task in ${duration_hours.toFixed(1)}h: ${task.text.slice(0, 50)}...`
    }],
  };
}
```

**Step 3: Build TypeScript**

Run: `cd ~/Documents/projects/oscribble-mcp && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
cd ~/Documents/projects/oscribble-mcp
git add src/index.ts
git commit -m "feat: add complete_task_with_timing tool"
```

**Step 5: Bump version and publish (optional)**

```bash
cd ~/Documents/projects/oscribble-mcp
npm version minor
npm publish
```

---

## Domain 5: Few-Shot Learning Prompt

**Objective:** Integrate completion history into Claude system prompt for calibrated estimates

### Task 5.1: Add Few-Shot Examples to Claude Prompt

**Files:**
- Modify: `src/services/claude.ts`

**Step 1: Import types**

```typescript
// Add to imports (around line 5)
import type { CompletionEntry } from '../types';
```

**Step 2: Add formatDuration helper**

```typescript
// Add before formatWithClaude function

function formatDuration(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) {
    const mins = Math.round(ms / (1000 * 60));
    return `${mins}m`;
  }
  return `${hours.toFixed(1)}h`;
}
```

**Step 3: Modify formatWithClaude signature**

```typescript
// Change function signature (around line 60)
export async function formatWithClaude(
  rawText: string,
  context: string = '',
  isVoiceInput: boolean = false,
  recentCompletions: CompletionEntry[] = []
): Promise<ClaudeFormatResponse> {
```

**Step 4: Add few-shot section to system prompt**

```typescript
// In formatWithClaude, after existing SYSTEM_PROMPT (around line 80)

let systemPrompt = SYSTEM_PROMPT;

// Add few-shot calibration examples if available
if (recentCompletions.length > 0) {
  systemPrompt += `\n\n## Time Estimate Calibration\n\nRecent task completions for this project (use these to calibrate your estimates):\n\n`;

  recentCompletions.forEach(completion => {
    const actual = formatDuration(completion.actual_time);
    const estimated = completion.estimated_time || 'not estimated';
    systemPrompt += `- Task: "${completion.text}"\n  Estimated: ${estimated} | Actual: ${actual}\n`;
  });

  systemPrompt += `\nUse these examples to calibrate your effort_estimate field for new tasks.\n`;
}
```

**Step 5: Use systemPrompt variable in API call**

```typescript
// Update the messages array (around line 100)
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8000,
  system: systemPrompt,  // Changed from SYSTEM_PROMPT
  messages: [
    {
      role: 'user',
      content: fullPrompt
    }
  ]
});
```

**Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/services/claude.ts
git commit -m "feat(claude): add few-shot learning from completion history"
```

### Task 5.2: Wire Completions into Format Flow

**Files:**
- Modify: `src/App.tsx`

**Step 1: Load completions before formatting**

```typescript
// In handleFormat function (around line 400), before formatWithClaude call

const completionsResult = await window.electronAPI.getRecentCompletions(10);
const recentCompletions = completionsResult.success ? completionsResult.completions || [] : [];
```

**Step 2: Pass completions to formatWithClaude**

```typescript
// Update formatWithClaude call
const result = await window.electronAPI.formatWithClaude(
  rawText,
  gatheredContext,
  false,
  recentCompletions
);
```

**Step 3: Update IPC handler in main process**

**Files:**
- Modify: `src/index.ts`

```typescript
// Update format-with-claude handler signature (around line 150)
ipcMain.handle(
  'format-with-claude',
  async (_event, rawText: string, context: string = '', isVoiceInput: boolean = false, completions: CompletionEntry[] = []) => {
    try {
      // Pass completions to ClaudeService
      const result = await ClaudeService.formatWithClaude(rawText, context, isVoiceInput, completions);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
);
```

**Step 4: Update preload types**

**Files:**
- Modify: `src/types/electron.d.ts`

```typescript
// Update formatWithClaude signature (around line 15)
formatWithClaude: (
  rawText: string,
  context?: string,
  isVoiceInput?: boolean,
  recentCompletions?: CompletionEntry[]
) => Promise<{ success: boolean; data?: any; error?: string }>;
```

**Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/App.tsx src/index.ts src/types/electron.d.ts
git commit -m "feat(app): wire completion history into format flow"
```

---

## Domain 6: UI Pulsing Indicator

**Objective:** Show pulsing orange dot on tasks with start_time && !duration

### Task 6.1: Add Pulsing Animation CSS

**Files:**
- Modify: `src/index.css`

**Step 1: Add keyframe animation**

```css
/* Add at end of file */

@keyframes pulse-orange {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

.pulse-indicator {
  animation: pulse-orange 2s ease-in-out infinite;
}
```

**Step 2: Test animation**

Run: `npm start`
Expected: App launches (animation will be visible once wired to TaskTree)

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(ui): add pulsing animation for active tasks"
```

### Task 6.2: Add Indicator to TaskTree Component

**Files:**
- Modify: `src/components/TaskTree.tsx`

**Step 1: Add isActive helper**

```typescript
// Add near top of component (around line 50)
const isTaskActive = (task: TaskNode): boolean => {
  return !!(task.metadata?.start_time && !task.metadata?.duration);
};
```

**Step 2: Add indicator JSX**

```typescript
// In task rendering section (around line 200), before checkbox
{isTaskActive(task) && (
  <div
    className="pulse-indicator w-2 h-2 rounded-full bg-[#FF4D00] mr-2"
    title="Task in progress"
  />
)}
```

**Step 3: Test with mock data**

Manually add to a task in notes.json:
```json
"metadata": {
  "start_time": 1697040000000
}
```

Run: `npm start`
Expected: Task shows pulsing orange dot

**Step 4: Remove mock data**

**Step 5: Commit**

```bash
git add src/components/TaskTree.tsx
git commit -m "feat(ui): show pulsing indicator for active tasks"
```

---

## Integration & Testing

### Task 7.1: End-to-End Test via MCP

**Step 1: Start Oscribble app**

Run: `npm start`

**Step 2: Test begin_task from Claude Code**

In Claude Code session:
```
"Begin timing task [paste-task-id] in oscribble project"
```

Expected: MCP responds with "✓ Started timing task..."

**Step 3: Verify indicator in UI**

Check: Pulsing orange dot appears on task

**Step 4: Test complete_task from Claude Code**

In Claude Code:
```
"Complete task [paste-task-id] in oscribble project"
```

Expected: MCP responds with duration, dot disappears

**Step 5: Verify completion_log.json**

Run: `cat ~/.project-stickies/oscribble/completion_log.json`
Expected: File exists with completion entry

**Step 6: Test few-shot learning**

1. Complete 2-3 more tasks with varying durations
2. Format new raw text with Cmd+Enter
3. Check: New tasks have effort_estimate calibrated to recent completions

**Step 7: Document results**

Create file: `docs/manual-tests/time-tracking-e2e.md`
Document: Steps taken, screenshots, any issues

### Task 7.2: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Add to README features**

```markdown
## Features

- ... existing features
- **Time Tracking & Learning**: Start/complete tasks via MCP, system learns from history to improve time estimates
```

**Step 2: Update CLAUDE.md with new MCP tools**

```markdown
## MCP Integration

**MCP Tools:**
- ... existing tools
- `oscribble_begin_task` - Start timing a task
- `oscribble_complete_task_with_timing` - Complete task and record duration
```

**Step 3: Add to Known Patterns**

```markdown
### Few-Shot Learning
Claude's time estimates improve over time using recent completion history. The system automatically includes the last 10 completions as calibration examples in the formatting prompt.
```

**Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add time tracking and learning features"
```

---

## Completion Checklist

- [ ] Domain 1: Storage layer with completion_log.json
- [ ] Domain 2: IPC handlers for start/complete/get-completions
- [ ] Domain 3: Python MCP server tools
- [ ] Domain 4: TypeScript MCP server tools
- [ ] Domain 5: Few-shot prompt integration
- [ ] Domain 6: UI pulsing indicator
- [ ] Domain 7: End-to-end testing
- [ ] Domain 8: Documentation updates

**Total estimated time:** 2-3 days (domains can be parallelized)

**Parallel execution:** Domains 1-4 and 6 are independent and can be implemented concurrently. Domain 5 depends on Domain 1-2. Domain 7 requires all domains complete.

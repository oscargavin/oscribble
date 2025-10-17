# Life Admin Projects Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add life admin project type to OSCR for non-code task management (personal, household, finance, etc.)

**Architecture:** Strategy pattern for context gathering - code projects use file discovery, life admin projects skip context. Both share task structure, UI, and dependency management. Different Claude prompts optimize for each domain.

**Tech Stack:** TypeScript, React 19, Electron, existing Anthropic/OpenAI integrations

---

## Task 1: Add Project Type to Type System

**Files:**
- Modify: `src/types/index.ts:39-44`

**Step 1: Add ProjectType discriminated union**

Add this after line 38:

```typescript
// Project types
export type ProjectType = 'code' | 'life_admin';

// Context strategy interface
export interface ContextStrategy {
  gatherContext(rawText: string, projectRoot: string): Promise<GatheredContext>;
  getCategories(): string[];
  shouldShowFileTree(): boolean;
}
```

**Step 2: Update ProjectSettings interface**

Modify ProjectSettings (lines 39-44) to include type field:

```typescript
export interface ProjectSettings {
  name: string;
  path: string;
  type: ProjectType;  // NEW
  created: number;
  last_accessed: number;
}
```

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ProjectType and ContextStrategy to type system"
```

---

## Task 2: Create Context Strategy Implementations

**Files:**
- Create: `src/services/context-strategy.ts`

**Step 1: Create strategy file with interface and implementations**

```typescript
import { GatheredContext, ProjectType, ContextStrategy } from '../types';

// Code project strategy - uses existing file discovery
export class CodeContextStrategy implements ContextStrategy {
  async gatherContext(rawText: string, projectRoot: string): Promise<GatheredContext> {
    // Call existing context gathering logic
    const result = await window.electronAPI.gatherProjectContext(rawText, projectRoot);

    if (!result.success || !result.data) {
      return {
        files: [],
        totalLines: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
    }

    return result.data;
  }

  getCategories(): string[] {
    return ['FEATURE', 'BUG', 'REFACTOR', 'ADMIN', 'DOCS', 'PERFORMANCE'];
  }

  shouldShowFileTree(): boolean {
    return true;
  }
}

// Life admin strategy - no file context
export class LifeAdminContextStrategy implements ContextStrategy {
  async gatherContext(rawText: string, projectRoot: string): Promise<GatheredContext> {
    // Return empty context for life admin projects
    return {
      files: [],
      totalLines: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  getCategories(): string[] {
    return ['FINANCE', 'HEALTH', 'HOUSEHOLD', 'LEGAL', 'PERSONAL', 'ERRANDS'];
  }

  shouldShowFileTree(): boolean {
    return false;
  }
}

// Factory function to get appropriate strategy
export function getContextStrategy(projectType: ProjectType): ContextStrategy {
  switch (projectType) {
    case 'code':
      return new CodeContextStrategy();
    case 'life_admin':
      return new LifeAdminContextStrategy();
    default:
      throw new Error(`Unknown project type: ${projectType}`);
  }
}
```

**Step 2: Commit**

```bash
git add src/services/context-strategy.ts
git commit -m "feat: add context strategy implementations for code and life admin"
```

---

## Task 3: Add Life Admin System Prompt to Claude Service

**Files:**
- Modify: `src/services/claude.ts:5-96`

**Step 1: Create life admin system prompt**

Add this constant after the existing SYSTEM_PROMPT (around line 96):

```typescript
const LIFE_ADMIN_SYSTEM_PROMPT = `You are a task breakdown assistant for personal life management.

Given raw task descriptions, you should:
1. Break down high-level tasks into concrete, actionable steps
2. Identify sequential dependencies (most life admin follows a linear flow)
3. Assign priorities based on urgency and importance
4. Suggest realistic deadlines based on common timelines
5. Create detailed subtasks that can be checked off one by one

Priority Guidelines:
- HIGH: Time-sensitive, legal deadlines, health-related, blocking other tasks
- MEDIUM: Important but flexible timeline, household maintenance, routine errands
- LOW: Aspirational goals, non-urgent improvements, optional tasks

Categories:
- FINANCE: Taxes, bills, investments, insurance, banking
- HEALTH: Appointments, prescriptions, insurance, fitness
- HOUSEHOLD: Repairs, maintenance, cleaning, organization
- LEGAL: Documents, renewals, compliance, official paperwork
- PERSONAL: Learning, hobbies, goals, relationships
- ERRANDS: Shopping, pickups, returns, deliveries

Task Breakdown Philosophy:
- Create MORE subtasks than you would for code projects
- Each subtask should be a single concrete action (e.g., "Call DMV", not "Handle DMV stuff")
- Subtasks should be sequential - each depends on the previous one completing
- Include helpful context in notes (e.g., "Most DMVs require 2-3 week lead time")
- Suggest specific deadlines when known (e.g., tax deadlines, document expirations)

When input is from speech-to-text (isVoiceInput=true):
- Be lenient with grammar and conversational patterns
- Extract discrete tasks from natural speech
- Convert conversational language to concise descriptions

Output JSON with STRUCTURED ARRAYS:

{
  "sections": [{
    "category": "FINANCE" | "HEALTH" | "HOUSEHOLD" | "LEGAL" | "PERSONAL" | "ERRANDS",
    "priority": "high" | "medium" | "low",
    "tasks": [{
      "text": string,
      "title": "short-kebab-case-identifier",
      "notes": ["helpful tip 1", "helpful tip 2"],
      "blocked_by": [],  // Not used for life admin (sequential only)
      "depends_on": [],  // Not used for life admin (sequential only)
      "related_to": [],  // Can reference other tasks
      "needs": ["requirement1"],
      "deadline": "2025-01-15" | "next week",
      "effort_estimate": "30m" | "2h" | "1d",
      "tags": ["urgent", "phone-call"],
      "subtasks": [{
        "text": "Step 1: Concrete action",
        "notes": ["Why this matters"],
        "deadline": "before main task",
        "effort_estimate": "15m"
      }]
    }]
  }],
  "warnings": ["warning1"],
  "context_used": []  // Always empty for life admin
}

IMPORTANT:
- ALL array fields MUST be proper JSON arrays
- Subtasks should be GRANULAR and SEQUENTIAL
- Each subtask is ONE action that can be checked off
- Don't reference files or code - focus on real-world actions
- Suggest specific deadlines when you know them (tax day, DMV renewal periods, etc.)
- Validate output is parseable JSON`;
```

**Step 2: Update formatTasks method signature**

Modify the formatTasks method (around line 110) to accept projectType:

```typescript
async formatTasks(
  rawText: string,
  contextStr: string,
  isVoiceInput: boolean = false,
  projectType: ProjectType = 'code',  // NEW parameter with default
  recentCompletions?: Array<{
    task_id: string;
    text: string;
    estimated_time?: string;
    actual_time: number;
    completed_at: number;
  }>,
  existingTasks?: TaskNode[]
): Promise<ClaudeFormatResponse> {
```

**Step 3: Use appropriate prompt based on project type**

In the formatTasks method, replace the system prompt selection (around line 163):

```typescript
// Select appropriate system prompt based on project type
const systemPrompt = projectType === 'life_admin'
  ? LIFE_ADMIN_SYSTEM_PROMPT
  : SYSTEM_PROMPT;

// Use prompt caching for cost efficiency
const message = await this.client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4000,
  system: [
    {
      type: 'text',
      text: systemPrompt,  // Changed from SYSTEM_PROMPT
      cache_control: { type: 'ephemeral' as const }
    }
  ],
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt,
        }
      ],
    },
  ],
});
```

**Step 4: Update ClaudeService export to include ProjectType import**

Add ProjectType to imports at top of file (line 2):

```typescript
import { ClaudeFormatResponse, TaskNode, ProjectType } from '../types';
```

**Step 5: Commit**

```bash
git add src/services/claude.ts
git commit -m "feat: add life admin system prompt with granular subtask focus"
```

---

## Task 4: Update Storage Service for Life Admin Projects

**Files:**
- Read: `src/services/storage.ts` (to understand current implementation)
- Modify: `src/services/storage.ts` (add project type handling)

**Step 1: Read existing storage implementation**

Read the file to understand current structure:

```bash
# This is informational - just read the file
```

**Step 2: Update getNotes and saveNotes to handle storage paths**

The storage service likely delegates to Electron IPC. The main change will be in the Electron main process (`src/index.ts`), but we need to ensure storage.ts handles project type properly.

**Note:** This task may need to be split based on actual storage.ts implementation. For now, mark this as a checkpoint to verify storage logic.

**Step 3: Commit placeholder**

```bash
git add src/services/storage.ts
git commit -m "chore: verify storage service handles project types"
```

---

## Task 5: Update Electron Main Process for Life Admin Storage

**Files:**
- Modify: `src/index.ts` (Electron main process)

**Step 1: Update storage paths for life admin projects**

Find the IPC handlers for getNotes and saveNotes. Update them to check project type and use different paths:

```typescript
// For code projects: projectRoot/.oscribble-notes.json
// For life admin: ~/Library/Application Support/OSCR/life-admin-{name}.json

ipcMain.handle('get-notes', async (event, projectName: string) => {
  try {
    const projects = await getProjects();
    const project = projects.find(p => p.name === projectName);

    if (!project) {
      return null;
    }

    let notesPath: string;
    if (project.type === 'life_admin') {
      // Life admin: store in app data directory
      const appDataPath = app.getPath('userData');
      notesPath = path.join(appDataPath, `life-admin-${projectName}.json`);
    } else {
      // Code project: store in project root
      notesPath = path.join(project.path, '.oscribble-notes.json');
    }

    if (!fs.existsSync(notesPath)) {
      return null;
    }

    const data = fs.readFileSync(notesPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get notes:', error);
    return null;
  }
});
```

Apply similar logic to saveNotes handler.

**Step 2: Update project creation to accept type**

Find the createProject or similar handler and add type parameter:

```typescript
ipcMain.handle('create-project', async (event, name: string, path: string, type: ProjectType = 'code') => {
  const project: ProjectSettings = {
    name,
    path: type === 'code' ? path : '', // Life admin projects don't need a path
    type,
    created: Date.now(),
    last_accessed: Date.now(),
  };

  // Save project to projects list...
});
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: update Electron storage to handle life admin project paths"
```

---

## Task 6: Update Setup Component for Project Type Selection

**Files:**
- Read: `src/components/Setup.tsx`
- Modify: `src/components/Setup.tsx`

**Step 1: Add project type selection UI**

Add radio buttons or toggle for selecting project type:

```typescript
const [projectType, setProjectType] = useState<ProjectType>('code');

// In the JSX, after project name input:
<div className="space-y-2">
  <label className="block text-sm text-[var(--text-dim)]">
    Project Type
  </label>
  <div className="flex gap-4">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        value="code"
        checked={projectType === 'code'}
        onChange={(e) => setProjectType(e.target.value as ProjectType)}
        className="form-radio"
      />
      <span className="text-[var(--text-primary)]">Code Project</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        value="life_admin"
        checked={projectType === 'life_admin'}
        onChange={(e) => setProjectType(e.target.value as ProjectType)}
        className="form-radio"
      />
      <span className="text-[var(--text-primary)]">Life Admin</span>
    </label>
  </div>
</div>
```

**Step 2: Conditionally show path picker**

Only show the directory picker if projectType is 'code':

```typescript
{projectType === 'code' && (
  <div className="space-y-2">
    <label className="block text-sm text-[var(--text-dim)]">
      Project Directory
    </label>
    {/* Existing path picker UI */}
  </div>
)}
```

**Step 3: Update project creation call**

Pass project type to createProject:

```typescript
const result = await window.electronAPI.createProject(
  projectName,
  projectType === 'code' ? projectPath : '',
  projectType
);
```

**Step 4: Commit**

```bash
git add src/components/Setup.tsx
git commit -m "feat: add project type selection to Setup component"
```

---

## Task 7: Update App.tsx to Use Context Strategy

**Files:**
- Modify: `src/App.tsx:1-16`

**Step 1: Import context strategy**

Add import at top of file:

```typescript
import { getContextStrategy } from "./services/context-strategy";
```

**Step 2: Add project type state**

Add state variable around line 24:

```typescript
const [projectType, setProjectType] = useState<ProjectType>('code');
```

**Step 3: Load project type when loading project**

In checkSetup useEffect (around line 98), load project type:

```typescript
if (project) {
  setProjectRoot(project.path);
  setProjectType(project.type || 'code'); // NEW: Load project type
}
```

**Step 4: Update handleFormat to use strategy**

In handleFormat function (around line 490), use strategy for context gathering:

```typescript
const handleFormat = async (
  rawText: string,
  contextStr: string,
  isVoiceInput: boolean = false,
  contextFiles?: { path: string; wasGrepped?: boolean; matchedKeywords?: string[]; }[]
) => {
  try {
    // Get appropriate strategy
    const strategy = getContextStrategy(projectType);

    // Only gather context if strategy requires it
    let finalContextStr = contextStr;
    let finalContextFiles = contextFiles;

    if (strategy.shouldShowFileTree() && !contextStr) {
      // Gather context using strategy
      const gatheredContext = await strategy.gatherContext(rawText, projectRoot);
      finalContextStr = gatheredContext.files.map(f => {
        const header = f.wasGrepped
          ? `--- ${f.path} (grep: ${f.matchedKeywords?.join(', ')}) ---`
          : `--- ${f.path} ---`;
        return `${header}\n${f.content}`;
      }).join('\n\n');

      finalContextFiles = gatheredContext.files.map(f => ({
        path: f.path,
        wasGrepped: f.wasGrepped,
        matchedKeywords: f.matchedKeywords
      }));
    }

    // ... rest of format logic

    // Format the text (pass projectType)
    const result = await window.electronAPI.formatWithClaude(
      textToFormat,
      finalContextStr,
      isVoiceInput,
      projectName,
      projectType  // NEW: Pass project type
    );

    // ... rest of function
  } catch (error) {
    console.error("Format error:", error);
    alert(`Failed to format: ${error.message}`);
  }
};
```

**Step 5: Conditionally render file tree panel**

In the JSX (around line 789), conditionally show file tree based on strategy:

```typescript
{view === "tasks" && (
  <TaskTree
    tasks={tasks}
    onUpdate={handleTaskUpdate}
    projectRoot={projectRoot}
    projectName={projectName}
    filterMode={filterMode}
    setFilterMode={setFilterMode}
    showContextFiles={showContextFiles}
    setShowContextFiles={setShowContextFiles}
    hasVoice={!!openaiApiKey}
    shouldShowFileTree={getContextStrategy(projectType).shouldShowFileTree()}  // NEW
  />
)}
```

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate context strategy pattern into App component"
```

---

## Task 8: Update TaskTree to Hide File Panel for Life Admin

**Files:**
- Read: `src/components/TaskTree.tsx`
- Modify: `src/components/TaskTree.tsx`

**Step 1: Add shouldShowFileTree prop**

Add prop to component signature:

```typescript
interface TaskTreeProps {
  tasks: TaskNode[];
  onUpdate: (tasks: TaskNode[]) => void;
  projectRoot: string;
  projectName: string;
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  showContextFiles: Set<string>;
  setShowContextFiles: (files: Set<string>) => void;
  hasVoice: boolean;
  shouldShowFileTree: boolean;  // NEW
}
```

**Step 2: Conditionally render file tree panel**

In the JSX, wrap file tree rendering:

```typescript
{shouldShowFileTree && (
  <div className="file-tree-panel">
    {/* Existing file tree UI */}
  </div>
)}
```

**Step 3: Adjust layout classes when file tree hidden**

Update layout to be full-width when file tree is hidden:

```typescript
<div className={`task-list ${shouldShowFileTree ? 'with-sidebar' : 'full-width'}`}>
  {/* Task list content */}
</div>
```

**Step 4: Commit**

```bash
git add src/components/TaskTree.tsx
git commit -m "feat: conditionally hide file tree for life admin projects"
```

---

## Task 9: Update ProjectSwitcher to Show Project Type Icons

**Files:**
- Modify: `src/components/ProjectSwitcher.tsx`

**Step 1: Add visual distinction for project types**

Update project list rendering to show icons:

```typescript
{projects.map((project) => (
  <div key={project.name} className="project-item">
    <span className="project-icon">
      {project.type === 'life_admin' ? '📋' : '🔧'}
    </span>
    <span className="project-name">{project.name}</span>
  </div>
))}
```

**Step 2: Commit**

```bash
git add src/components/ProjectSwitcher.tsx
git commit -m "feat: add visual indicators for project types in switcher"
```

---

## Task 10: Update Electron IPC for formatWithClaude

**Files:**
- Modify: `src/index.ts` (IPC handler)

**Step 1: Update formatWithClaude handler to accept projectType**

```typescript
ipcMain.handle(
  'format-with-claude',
  async (
    event,
    rawText: string,
    contextStr: string,
    isVoiceInput: boolean,
    projectName: string,
    projectType: ProjectType = 'code'  // NEW parameter
  ) => {
    try {
      // Get project to determine type if not provided
      const projects = await getProjects();
      const project = projects.find(p => p.name === projectName);
      const finalProjectType = projectType || project?.type || 'code';

      // Load completion log and existing tasks for context
      const completionLog = await loadCompletionLog(projectName);
      const recentCompletions = completionLog?.completions.slice(-5) || [];

      const notes = await getNotes(projectName);
      const existingTasks = notes?.tasks || [];

      // Format with appropriate project type
      const response = await claudeService.formatTasks(
        rawText,
        contextStr,
        isVoiceInput,
        finalProjectType,  // Pass project type
        recentCompletions,
        existingTasks
      );

      return { success: true, data: response };
    } catch (error: any) {
      console.error('Format error:', error);
      return { success: false, error: error.message };
    }
  }
);
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: pass project type to Claude formatting service"
```

---

## Task 11: Manual Testing

**Files:**
- N/A (testing)

**Step 1: Test creating life admin project**

Run the app:
```bash
npm start
```

1. Create a new project
2. Select "Life Admin" type
3. Skip path selection
4. Verify project is created

Expected: Project appears in switcher with 📋 icon

**Step 2: Test formatting life admin tasks**

1. Open life admin project
2. Enter raw text: "Renew driver's license by March 1st"
3. Click Format
4. Verify Claude creates granular subtasks

Expected: Multiple sequential subtasks (check expiration, gather docs, schedule appointment, etc.)

**Step 3: Test file tree hidden**

1. Switch to tasks view
2. Verify no file tree panel appears

Expected: Full-width task list, no file context panel

**Step 4: Test code project still works**

1. Create a new code project
2. Verify file tree appears
3. Verify @mentions work
4. Format some code tasks

Expected: Existing functionality unchanged

**Step 5: Document any issues**

If any issues found, create follow-up tasks.

---

## Task 12: Update Migration for Existing Projects

**Files:**
- Modify: `src/index.ts` (add migration logic)

**Step 1: Add migration on app start**

```typescript
async function migrateProjectsToIncludeType() {
  try {
    const projects = await getProjects();
    let needsMigration = false;

    const migratedProjects = projects.map(project => {
      if (!project.type) {
        needsMigration = true;
        return {
          ...project,
          type: 'code' as ProjectType  // Default existing projects to code
        };
      }
      return project;
    });

    if (needsMigration) {
      await saveProjects(migratedProjects);
      console.log('Migrated projects to include type field');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Call on app ready
app.whenReady().then(() => {
  migrateProjectsToIncludeType();
  createWindow();
});
```

**Step 2: Test migration**

1. Test with existing OSCR installation
2. Verify existing projects default to 'code' type
3. Verify they still work correctly

Expected: All existing projects load as code projects

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: migrate existing projects to include type field"
```

---

## Task 13: Update Type Definitions for Electron API

**Files:**
- Modify: `src/types/electron.d.ts` (or wherever Electron API types are defined)

**Step 1: Update createProject signature**

```typescript
interface ElectronAPI {
  // ... existing methods
  createProject: (name: string, path: string, type: ProjectType) => Promise<{ success: boolean; error?: string }>;
  formatWithClaude: (
    rawText: string,
    contextStr: string,
    isVoiceInput: boolean,
    projectName: string,
    projectType?: ProjectType
  ) => Promise<{ success: boolean; data?: ClaudeFormatResponse; error?: string }>;
  // ... rest of API
}
```

**Step 2: Commit**

```bash
git add src/types/electron.d.ts
git commit -m "feat: update Electron API types for project type support"
```

---

## Summary

This implementation adds life admin projects to OSCR using a strategy pattern for context gathering. Key changes:

1. **Type System** - Added `ProjectType` and `ContextStrategy` interfaces
2. **Strategy Pattern** - Separate strategies for code and life admin context
3. **Claude Prompts** - Life admin prompt focuses on granular, sequential subtasks
4. **Storage** - Life admin projects stored in app data, code projects in project root
5. **UI** - Conditional file tree, project type icons, type selection in setup
6. **Migration** - Existing projects default to code type

The design maintains backward compatibility while enabling a new project type that can evolve independently.

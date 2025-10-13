# Auto-Context Discovery Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Automatically discover relevant code files for task analysis without requiring explicit @ mentions, using Claude to intelligently select files and grep large files for relevant sections.

**Architecture:** Two-stage context gathering - (1) Claude analyzes raw task text + file tree to select 3-8 relevant files, extracting keywords for files >300 lines; (2) Load/grep selected files with 7-day caching. Unified with existing @mention system. Context metadata displayed in TaskTree.

**Tech Stack:** Claude Sonnet 4.5 (file selection), Node.js child_process (tree/grep), existing Electron IPC + caching infrastructure.

**Feature Flag:** `ENABLE_AUTO_CONTEXT` environment variable (default: true for new feature, can be disabled if issues arise).

---

## Task 1: Add Type Definitions

**Files:**
- Modify: `src/types/index.ts` (add to end of file)
- Modify: `src/types/electron.d.ts` (add to IPC interface)

**Step 1: Add core types to src/types/index.ts**

Add these interfaces at the end of the file (before the final closing brace if there is one):

```typescript
// Auto-context discovery types
export interface ContextDiscoveryRequest {
  rawText: string;
  projectRoot: string;
  fileTree: string;
}

export interface ContextDiscoveryResponse {
  explicit: string[];  // Files from @ mentions
  discovered: DiscoveredFile[];
  reasoning: string;  // Why Claude picked these files
}

export interface DiscoveredFile {
  file: string;
  readFully: boolean;
  keywords?: string[];  // Only if readFully = false
}

export interface FileContext {
  path: string;
  content: string;  // Full file or grep results
  lineCount: number;
  wasGrepped: boolean;
  matchedKeywords?: string[];  // If grepped
}

export interface GatheredContext {
  files: FileContext[];
  totalLines: number;
  cacheHits: number;
  cacheMisses: number;
}
```

**Step 2: Extend ClaudeFormatResponse type**

Find the `ClaudeFormatResponse` interface in `src/types/index.ts` and add the optional field:

```typescript
export interface ClaudeFormatResponse {
  // ... existing fields ...
  context_used?: {
    file: string;
    reason: string;
  }[];
}
```

**Step 3: Add IPC method signature to src/types/electron.d.ts**

Add this method to the `ElectronAPI` interface:

```typescript
  gatherProjectContext(rawText: string, projectRoot: string): Promise<IPCResponse<GatheredContext>>;
```

**Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors (baseline errors are OK)

**Step 5: Commit types**

```bash
git add src/types/index.ts src/types/electron.d.ts
git commit -m "feat: add types for auto-context discovery

- ContextDiscoveryRequest/Response for Claude file selection
- FileContext/GatheredContext for unified context gathering
- Extend ClaudeFormatResponse with context_used metadata"
```

---

## Task 2: Create Auto-Context Service (Part 1: File Tree Generation)

**Files:**
- Create: `src/services/auto-context.ts`

**Step 1: Create service skeleton**

Create `src/services/auto-context.ts` with imports and class structure:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ContextDiscoveryRequest,
  ContextDiscoveryResponse,
  DiscoveredFile,
  FileContext,
  GatheredContext
} from '../types';

const execAsync = promisify(exec);

export class AutoContextService {
  private fileTreeCache: Map<string, { tree: string; timestamp: number }> = new Map();
  private readonly FILE_TREE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Main entry point: discover relevant context from raw text
   */
  async discoverContext(
    rawText: string,
    projectRoot: string
  ): Promise<GatheredContext> {
    throw new Error('Not implemented yet');
  }

  /**
   * Generate file tree using tree command (cached for 5 minutes)
   */
  private async generateFileTree(
    projectRoot: string,
    maxDepth: number = 4
  ): Promise<string> {
    // Check cache
    const cached = this.fileTreeCache.get(projectRoot);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.FILE_TREE_CACHE_TTL) {
      return cached.tree;
    }

    // Try tree command first
    try {
      const { stdout } = await execAsync(
        `tree -L ${maxDepth} -I "node_modules|.git|out|.webpack|.vite|coverage|dist" "${projectRoot}"`,
        { maxBuffer: 1024 * 1024 } // 1MB buffer
      );

      this.fileTreeCache.set(projectRoot, { tree: stdout, timestamp: now });
      return stdout;
    } catch (error) {
      // Fallback: use find command if tree not available
      try {
        const { stdout } = await execAsync(
          `find "${projectRoot}" -maxdepth ${maxDepth} -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/out/*" ! -path "*/.webpack/*"`,
          { maxBuffer: 1024 * 1024 }
        );

        this.fileTreeCache.set(projectRoot, { tree: stdout, timestamp: now });
        return stdout;
      } catch (fallbackError) {
        throw new Error(`Failed to generate file tree: ${(fallbackError as Error).message}`);
      }
    }
  }
}

export default new AutoContextService();
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 3: Commit skeleton**

```bash
git add src/services/auto-context.ts
git commit -m "feat: add auto-context service skeleton with file tree generation

- generateFileTree() with tree/find fallback
- 5-minute cache for file trees
- Excludes common build/dependency directories"
```

---

## Task 3: Auto-Context Service (Part 2: Claude File Selection)

**Files:**
- Modify: `src/services/auto-context.ts`

**Step 1: Import Claude service**

Add import at top of file:

```typescript
import ClaudeService from './claude';
```

**Step 2: Implement selectFiles method**

Add this method to the `AutoContextService` class:

```typescript
  /**
   * Use Claude to select relevant files from the tree
   */
  private async selectFiles(
    fileTree: string,
    rawText: string
  ): Promise<ContextDiscoveryResponse> {
    const prompt = `You are helping a task manager analyze which source code files are relevant to a user's tasks.

FILE TREE:
${fileTree}

USER'S RAW TASKS:
${rawText}

Instructions:
1. Identify files explicitly mentioned with @ syntax (e.g., @src/App.tsx) - these MUST be included
2. Discover up to 8 additional files that would help analyze these tasks
3. Total budget: ~2000 lines of code across all files
4. For files likely >300 lines, set readFully=false and provide 2-4 specific keywords to grep

Return JSON only (no markdown):
{
  "explicit": ["path/from/@mentions"],
  "discovered": [
    {"file": "src/path/file.ts", "readFully": true},
    {"file": "src/large.ts", "readFully": false, "keywords": ["function", "export"]}
  ],
  "reasoning": "Brief explanation of why these files matter"
}`;

    try {
      const response = await ClaudeService.sendMessage(prompt, []);

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Claude did not return valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ContextDiscoveryResponse;

      // Validate structure
      if (!Array.isArray(parsed.explicit) || !Array.isArray(parsed.discovered)) {
        throw new Error('Invalid response structure from Claude');
      }

      return parsed;
    } catch (error) {
      console.error('Error selecting files with Claude:', error);
      // Return empty discovery on error (graceful degradation)
      return {
        explicit: [],
        discovered: [],
        reasoning: `Error: ${(error as Error).message}`
      };
    }
  }
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 4: Commit file selection**

```bash
git add src/services/auto-context.ts
git commit -m "feat: implement Claude-based file selection

- selectFiles() uses Claude to analyze file tree + tasks
- Returns explicit (@mentions) + discovered files
- Graceful degradation on API errors"
```

---

## Task 4: Auto-Context Service (Part 3: File Loading and Grep)

**Files:**
- Modify: `src/services/auto-context.ts`

**Step 1: Add grep helper method**

Add this method to the `AutoContextService` class:

```typescript
  /**
   * Grep file for keywords with context lines
   */
  private async grepFile(
    filePath: string,
    keywords: string[]
  ): Promise<string> {
    const pattern = keywords.join('|');

    try {
      const { stdout } = await execAsync(
        `grep -n -C 5 -E "${pattern}" "${filePath}" | head -n 300`,
        { maxBuffer: 512 * 1024 } // 512KB buffer
      );

      return stdout || `[No matches found for keywords: ${keywords.join(', ')}]`;
    } catch (error: any) {
      // grep exit code 1 means no matches (not an error)
      if (error.code === 1) {
        return `[No matches found for keywords: ${keywords.join(', ')}]`;
      }
      throw error;
    }
  }
```

**Step 2: Add file loading method with caching**

Add these methods to the class:

```typescript
  /**
   * Load files with caching (reuses existing context cache from context.ts pattern)
   */
  private async loadFiles(
    discovered: DiscoveredFile[],
    projectRoot: string,
    cacheDir: string
  ): Promise<FileContext[]> {
    const results: FileContext[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const item of discovered) {
      const fullPath = path.isAbsolute(item.file)
        ? item.file
        : path.join(projectRoot, item.file);

      if (!fs.existsSync(fullPath)) {
        console.warn(`File not found: ${fullPath}`);
        continue;
      }

      const stats = fs.statSync(fullPath);
      const cacheKey = `${item.file}-${stats.mtimeMs}`;
      const cachePath = path.join(cacheDir, `${Buffer.from(cacheKey).toString('base64')}.txt`);

      let content: string;
      let wasGrepped = false;
      let matchedKeywords: string[] | undefined;

      // Check cache
      if (fs.existsSync(cachePath)) {
        const cacheStats = fs.statSync(cachePath);
        const age = Date.now() - cacheStats.mtimeMs;

        if (age < 7 * 24 * 60 * 60 * 1000) { // 7 days
          content = fs.readFileSync(cachePath, 'utf-8');
          cacheHits++;
        } else {
          fs.unlinkSync(cachePath); // Expired
          content = await this.readOrGrepFile(fullPath, item);
          fs.writeFileSync(cachePath, content);
          cacheMisses++;
          wasGrepped = !item.readFully;
          matchedKeywords = item.keywords;
        }
      } else {
        content = await this.readOrGrepFile(fullPath, item);
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cachePath, content);
        cacheMisses++;
        wasGrepped = !item.readFully;
        matchedKeywords = item.keywords;
      }

      const lineCount = content.split('\n').length;

      results.push({
        path: item.file,
        content,
        lineCount,
        wasGrepped,
        matchedKeywords
      });
    }

    return results;
  }

  private async readOrGrepFile(
    fullPath: string,
    item: DiscoveredFile
  ): Promise<string> {
    if (item.readFully) {
      return fs.readFileSync(fullPath, 'utf-8');
    } else if (item.keywords && item.keywords.length > 0) {
      return await this.grepFile(fullPath, item.keywords);
    } else {
      // No keywords provided, read first 300 lines
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n').slice(0, 300);
      return lines.join('\n') + '\n[... truncated, no keywords provided]';
    }
  }
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 4: Commit file loading**

```bash
git add src/services/auto-context.ts
git commit -m "feat: implement file loading with grep and caching

- loadFiles() handles full reads vs grep
- 7-day cache with mtime invalidation
- grepFile() with 5 lines context, max 300 lines"
```

---

## Task 5: Auto-Context Service (Part 4: Main Entry Point)

**Files:**
- Modify: `src/services/auto-context.ts`

**Step 1: Implement discoverContext method**

Replace the `discoverContext` stub with:

```typescript
  /**
   * Main entry point: discover relevant context from raw text
   */
  async discoverContext(
    rawText: string,
    projectRoot: string
  ): Promise<GatheredContext> {
    const cacheDir = path.join(projectRoot, '.context-cache');

    try {
      // Step 1: Generate file tree
      const fileTree = await this.generateFileTree(projectRoot);

      // Step 2: Let Claude select files
      const selection = await this.selectFiles(fileTree, rawText);

      // Step 3: Combine explicit and discovered files
      const allFiles: DiscoveredFile[] = [
        ...selection.explicit.map(f => ({ file: f, readFully: true })),
        ...selection.discovered
      ];

      // Step 4: Enforce budget (adaptive line limits)
      const budgetedFiles = this.enforceLineBudget(allFiles, selection.explicit.length);

      // Step 5: Load files
      const fileContexts = await this.loadFiles(budgetedFiles, projectRoot, cacheDir);

      const totalLines = fileContexts.reduce((sum, fc) => sum + fc.lineCount, 0);
      const cacheHits = fileContexts.filter(fc => fc.wasGrepped === false).length;
      const cacheMisses = fileContexts.length - cacheHits;

      return {
        files: fileContexts,
        totalLines,
        cacheHits,
        cacheMisses
      };
    } catch (error) {
      console.error('Error in discoverContext:', error);
      // Return empty context on error (graceful degradation)
      return {
        files: [],
        totalLines: 0,
        cacheHits: 0,
        cacheMisses: 0
      };
    }
  }

  /**
   * Enforce budget: drop lowest-priority discovered files if over 2000 lines
   */
  private enforceLineBudget(
    files: DiscoveredFile[],
    explicitCount: number
  ): DiscoveredFile[] {
    // Adaptive line limits based on file count
    const totalFiles = files.length;
    let maxLinesPerFile: number;

    if (totalFiles === 1) maxLinesPerFile = 1000;
    else if (totalFiles <= 3) maxLinesPerFile = 400;
    else maxLinesPerFile = 250;

    // Adjust discovered files to meet budget
    const explicit = files.slice(0, explicitCount);
    const discovered = files.slice(explicitCount);

    // Sort discovered by readFully (true first, as they're likely smaller/more important)
    discovered.sort((a, b) => (b.readFully ? 1 : 0) - (a.readFully ? 1 : 0));

    // Keep all explicit, trim discovered if needed
    let estimatedLines = explicitCount * maxLinesPerFile;
    const kept: DiscoveredFile[] = [];

    for (const file of discovered) {
      const estimatedFileLines = file.readFully ? maxLinesPerFile : 150;
      if (estimatedLines + estimatedFileLines <= 2000) {
        kept.push(file);
        estimatedLines += estimatedFileLines;
      }
    }

    return [...explicit, ...kept];
  }
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 3: Commit main entry point**

```bash
git add src/services/auto-context.ts
git commit -m "feat: implement auto-context main entry point

- discoverContext() orchestrates tree → select → load
- enforceLineBudget() with adaptive limits (1 file=1000 lines, 5 files=250 each)
- Graceful degradation on all errors"
```

---

## Task 6: Integrate with Context Service

**Files:**
- Modify: `src/services/context.ts`

**Step 1: Import auto-context service**

Add import at top of file:

```typescript
import AutoContextService from './auto-context';
import { GatheredContext, FileContext } from '../types';
```

**Step 2: Add unified gatherProjectContext method**

Add this method to the `ContextService` class (after existing methods):

```typescript
  /**
   * Unified context gathering: @mentions + auto-discovery
   */
  async gatherProjectContext(
    rawText: string,
    projectRoot: string
  ): Promise<GatheredContext> {
    // Check feature flag
    const autoContextEnabled = process.env.ENABLE_AUTO_CONTEXT !== 'false';

    if (!autoContextEnabled) {
      // Fall back to explicit @mentions only
      const explicitContext = await this.gatherContext(rawText, projectRoot);
      return {
        files: [
          {
            path: '@mentions',
            content: explicitContext,
            lineCount: explicitContext.split('\n').length,
            wasGrepped: false
          }
        ],
        totalLines: explicitContext.split('\n').length,
        cacheHits: 0,
        cacheMisses: 1
      };
    }

    // Auto-discovery enabled
    const autoContext = await AutoContextService.discoverContext(rawText, projectRoot);

    // Also gather explicit @mentions (legacy support)
    const explicitContext = await this.gatherContext(rawText, projectRoot);

    // Merge contexts
    if (explicitContext && explicitContext.trim().length > 0) {
      autoContext.files.unshift({
        path: '@mentions (explicit)',
        content: explicitContext,
        lineCount: explicitContext.split('\n').length,
        wasGrepped: false
      });
      autoContext.totalLines += explicitContext.split('\n').length;
    }

    return autoContext;
  }
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 4: Commit context integration**

```bash
git add src/services/context.ts
git commit -m "feat: add unified gatherProjectContext method

- Combines @mentions + auto-discovery
- Respects ENABLE_AUTO_CONTEXT env var (default: true)
- Graceful fallback to @mentions-only if disabled"
```

---

## Task 7: Update Claude Service System Prompt

**Files:**
- Modify: `src/services/claude.ts`

**Step 1: Update SYSTEM_PROMPT constant**

Find the `SYSTEM_PROMPT` constant (around lines 4-52) and add this section after the existing instructions:

```typescript
const SYSTEM_PROMPT = `You are a task analysis assistant for Oscribble...

[... existing instructions ...]

## Context Usage Metadata

When you receive code context (either from @mentions or auto-discovered files), include context usage metadata in your response:

{
  "sections": [...],
  "tasks": [...],
  "warnings": [...],
  "context_used": [
    {"file": "src/App.tsx", "reason": "Modified voice recording initialization"},
    {"file": "src/hooks/useVoiceRecording.ts", "reason": "Core recording state management"}
  ]
}

The context_used field should list which files informed your analysis and why. This helps users understand how context influenced your decisions.

[... rest of existing prompt ...]
`;
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 3: Commit prompt update**

```bash
git add src/services/claude.ts
git commit -m "feat: update Claude prompt to return context usage metadata

- Instructs Claude to return context_used array
- Each entry explains which file and why it was relevant"
```

---

## Task 8: Add IPC Handler in Main Process

**Files:**
- Modify: `src/index.ts`

**Step 1: Import context service at top of file**

Ensure `ContextService` is imported (should already exist):

```typescript
import ContextService from './services/context';
```

**Step 2: Add IPC handler**

Find where other IPC handlers are registered (search for `ipcMain.handle`) and add:

```typescript
ipcMain.handle('gather-project-context', async (event, rawText: string, projectRoot: string) => {
  try {
    const context = await ContextService.gatherProjectContext(rawText, projectRoot);
    return { success: true, data: context };
  } catch (error: any) {
    console.error('Error gathering project context:', error);
    return { success: false, error: error.message };
  }
});
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 4: Commit IPC handler**

```bash
git add src/index.ts
git commit -m "feat: add gather-project-context IPC handler

- Calls ContextService.gatherProjectContext()
- Returns GatheredContext with success/error wrapper"
```

---

## Task 9: Expose IPC Method in Preload

**Files:**
- Modify: `src/preload.ts`

**Step 1: Add method to context bridge**

Find the `contextBridge.exposeInMainWorld` call and add this method to the `electronAPI` object:

```typescript
  gatherProjectContext: (rawText: string, projectRoot: string) =>
    ipcRenderer.invoke('gather-project-context', rawText, projectRoot),
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 3: Commit preload update**

```bash
git add src/preload.ts
git commit -m "feat: expose gatherProjectContext in preload bridge"
```

---

## Task 10: Update App.tsx to Use New Context Method

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update handleFormatTasks method**

Find the `handleFormatTasks` method (around line 300+) and replace the context gathering call.

Look for this pattern:
```typescript
const contextResult = await window.electronAPI.gatherContext(rawText, currentProject.path);
```

Replace with:
```typescript
const contextResult = await window.electronAPI.gatherProjectContext(rawText, currentProject.path);
```

**Step 2: Update context formatting for Claude**

Find where the context is passed to `formatWithClaude`. Update to handle the new structure:

```typescript
// Format gathered context for Claude
let contextString = '';
if (contextResult.success && contextResult.data) {
  const gc = contextResult.data;
  contextString = gc.files.map(f => {
    const header = f.wasGrepped
      ? `--- ${f.path} (grep: ${f.matchedKeywords?.join(', ')}) ---`
      : `--- ${f.path} ---`;
    return `${header}\n${f.content}`;
  }).join('\n\n');

  console.log(`Context: ${gc.files.length} files, ${gc.totalLines} lines (${gc.cacheHits} cached)`);
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 4: Test in dev mode**

Run: `npm start`
Expected: App opens, DevTools available

Try formatting a task to ensure no runtime errors (don't worry if context isn't perfect yet).

**Step 5: Commit App.tsx changes**

```bash
git add src/App.tsx
git commit -m "feat: integrate auto-context in App.tsx

- Use gatherProjectContext instead of gatherContext
- Format GatheredContext for Claude with grep indicators
- Log context stats (files, lines, cache hits)"
```

---

## Task 11: Add Context Display in TaskTree UI

**Files:**
- Modify: `src/components/TaskTree.tsx`

**Step 1: Add context display after metadata**

Find where task metadata is rendered (priority, deadline, etc.) and add a context section.

Look for the section that renders `task.metadata?.priority` and add after it:

```typescript
{/* Context used */}
{task.metadata?.notes && task.metadata.notes.some(note => note.startsWith('Context:')) && (
  <div className="mt-1 text-xs text-dim">
    <div className="font-bold">Context:</div>
    {task.metadata.notes
      .filter(note => note.startsWith('Context:'))
      .map((note, i) => (
        <div key={i} className="ml-2">
          • {note.replace('Context: ', '')}
        </div>
      ))}
  </div>
)}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No new type errors

**Step 3: Test UI in dev mode**

Run: `npm start`
Expected: App opens, context section appears for tasks with context metadata

**Step 4: Commit UI changes**

```bash
git add src/components/TaskTree.tsx
git commit -m "feat: display context usage in TaskTree

- Shows files used for task analysis
- Rendered as collapsed metadata section"
```

---

## Task 12: End-to-End Testing

**Files:**
- Test manually in dev mode

**Step 1: Start app in dev mode**

Run: `npm start`
Expected: App opens with DevTools

**Step 2: Create test project**

1. If no project exists, create one in Setup
2. Use a real codebase with multiple files (e.g., the Oscribble project itself)

**Step 3: Test auto-context discovery**

In raw input, type:
```
- fix the voice recording bug
- refactor storage to use async/await
```

Hit Cmd+Enter

Expected:
- DevTools console shows: "Context: X files, Y lines (Z cached)"
- Tasks appear in TaskTree
- Check DevTools Network tab for Claude API calls (should see file selection + formatting)

**Step 4: Test feature flag**

Set environment variable:
```bash
ENABLE_AUTO_CONTEXT=false npm start
```

Type same tasks, format

Expected:
- Console shows fallback to @mentions only
- Still works, just without auto-discovery

**Step 5: Test explicit @mentions still work**

In raw input, type:
```
- update @src/App.tsx to fix the bug
```

Expected:
- @mention is detected
- File is included in context
- Tasks format correctly

**Step 6: Test large file grep**

Create a test file with >300 lines, add task mentioning it conceptually (not by name)

Expected:
- Claude selects the file
- Service greps it (check console)
- Context includes grep results, not full file

**Step 7: Verify no regressions**

Test existing features:
- Voice recording (Cmd+R)
- Project switching (Cmd+K)
- Task editing, completion

Expected: All work as before

**Step 8: Document test results**

Create `docs/testing/2025-10-13-auto-context-test-results.md`:

```markdown
# Auto-Context Discovery Test Results

## Test Date: 2025-10-13

## Test 1: Basic Discovery
- Input: "fix voice recording bug"
- Files discovered: [list]
- Lines total: [number]
- Result: PASS/FAIL

## Test 2: Feature Flag OFF
- ENABLE_AUTO_CONTEXT=false
- Result: PASS/FAIL

## Test 3: Explicit @mentions
- Input: "@src/App.tsx fix bug"
- Result: PASS/FAIL

## Test 4: Large File Grep
- File: [path]
- Keywords: [list]
- Result: PASS/FAIL

## Regressions
- None detected / [list issues]
```

**Step 9: Commit test results**

```bash
git add docs/testing/
git commit -m "test: manual E2E testing of auto-context discovery"
```

---

## Task 13: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (if user-facing)

**Step 1: Update CLAUDE.md architecture section**

Find the "Key Workflows" → "Task Formatting Flow" section and update:

```markdown
### Task Formatting Flow

1. User types raw text in `RawInput.tsx`
2. Autosave to `raw.txt` (300ms debounce)
3. User presses Cmd+Enter
4. App.tsx calls `window.electronAPI.gatherProjectContext()` to:
   - Extract explicit @ mentions
   - Generate file tree (cached 5min)
   - Use Claude to select 3-8 relevant files
   - Load/grep selected files (cached 7 days)
5. Merged context sent to Claude Sonnet 4.5
6. Response parsed into `ClaudeFormatResponse` (sections, tasks, warnings, context_used)
7. Converted to `TaskNode[]` with UUIDs
8. Appended to existing tasks, saved to `notes.json`
9. View switches to `TaskTree.tsx`
```

**Step 2: Add feature flag documentation**

Add to "Development" section:

```markdown
### Feature Flags

**ENABLE_AUTO_CONTEXT** (default: true)
- Enables automatic code context discovery
- When disabled, only explicit @mentions are used
- Set to `false` if experiencing API cost issues

Usage: `ENABLE_AUTO_CONTEXT=false npm start`
```

**Step 3: Update component responsibilities**

Add to "Component Responsibilities":

```markdown
### AutoContextService (src/services/auto-context.ts)
**Automatic context discovery**:
- Generates file tree (tree command, 5min cache)
- Uses Claude to select relevant files (3-8 files, ~2000 lines budget)
- Greps large files (>300 lines) with keywords
- Caches loaded files (7-day expiry)
```

**Step 4: Commit documentation**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for auto-context feature

- Updated task formatting workflow
- Added AutoContextService component docs
- Document ENABLE_AUTO_CONTEXT feature flag"
```

---

## Task 14: Final Build and Release Prep

**Files:**
- Modify: `package.json` (version bump)

**Step 1: Run full lint check**

Run: `npm run lint`
Expected: No new errors beyond baseline (18 errors, 21 warnings)

**Step 2: Build production app**

Run: `npm run make`
Expected: Builds successfully, outputs to `out/make/`

**Step 3: Test production build**

Run the built app:
```bash
open out/Oscribble-darwin-arm64/Oscribble.app
```

Test auto-context feature in production build

Expected: Works identically to dev mode

**Step 4: Bump version in package.json**

Change version from `1.1.0` to `1.2.0` (minor feature addition)

**Step 5: Commit version bump**

```bash
git add package.json
git commit -m "chore: bump version to 1.2.0 for auto-context release"
```

**Step 6: Create git tag**

```bash
git tag v1.2.0
```

**Step 7: Final verification**

Run: `git log --oneline -15`
Expected: Clean commit history following conventional commits

---

## Completion Checklist

- [ ] All TypeScript compiles without new errors
- [ ] Feature works in dev mode (npm start)
- [ ] Feature works in production build (npm run make)
- [ ] Feature flag (ENABLE_AUTO_CONTEXT) works
- [ ] No regressions in existing features
- [ ] Documentation updated (CLAUDE.md)
- [ ] Version bumped to 1.2.0
- [ ] Clean commit history

## Known Issues / Future Work

- [ ] No unit tests yet (add in future PR)
- [ ] No retry logic for Claude API failures in file selection
- [ ] Context display in UI is basic (could show expandable file previews)
- [ ] No user preference for auto-context (always on or always off per project)
- [ ] Tree command might not be installed (fallback works but could be better)

## Estimated Time

- Tasks 1-9: ~45 minutes (types, services, IPC)
- Tasks 10-11: ~20 minutes (integration, UI)
- Tasks 12-14: ~30 minutes (testing, docs, release)
- **Total: ~1.5-2 hours**

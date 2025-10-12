**PROJECT STICKIES - TECHNICAL PRD**

---

## EXECUTIVE SUMMARY

Desktop note-taking app for Mac developers. Terminal aesthetic. Raw bullet input → Claude structures/validates → checkbox tree for execution. Local-first, lightweight Electron, Claude Agent SDK integration.

**Core value:** Transform brain dump into actionable, dependency-aware task list with AI insights.

---

## 1. TECHNICAL ARCHITECTURE

### 1.1 Stack
```
Electron 32+ (latest stable)
├─ Main Process
│  ├─ Node.js runtime
│  ├─ @anthropic-ai/claude-agent-sdk (TS)
│  ├─ File system access
│  └─ IPC handlers
└─ Renderer Process
   ├─ React 18+
   ├─ Tailwind CSS 3+
   └─ Monaco/CodeMirror (minimal) for text input
```

### 1.2 Size Optimization Strategy
Base Electron apps are ~120-150MB due to bundled Chromium. Target: <80MB installed.

**Tactics:**
- electron-builder with asar compression
- Exclude source maps in production
- Remove .map files from build
- Dependencies in devDependencies where possible
- Tree-shake unused Tailwind
- No heavy UI libs (chart.js, etc)
- Single window, no webview embeds

**Build config:**
```json
"build": {
  "asar": true,
  "compression": "maximum",
  "files": ["dist/**/*"],
  "extraMetadata": {
    "main": "dist/main.js"
  }
}
```

### 1.3 Authentication
Claude Agent SDK supports Claude API key or subscription-based auth. User has Max plan → subscription auth preferred.

**Implementation:**
- On first launch: prompt for auth method
- Store encrypted credentials in Keychain (macOS)
- SDK auto-handles rate limits via subscription
- Fallback to API key if subscription unavailable

```typescript
import { ClaudeSDKClient, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

const options: ClaudeAgentOptions = {
  // Auth handled by SDK via env or subscription
  systemPrompt: "You are a task analysis assistant...",
  maxTurns: 3
};
```

---

## 2. DATA ARCHITECTURE

### 2.1 Storage Schema
```
~/.project-stickies/
├─ projects.json          # Project registry
├─ settings.json          # App preferences
└─ [project-name]/
   ├─ notes.json          # Task tree state
   └─ .context-cache/     # File snapshots for diffing
      └─ [filename].hash
```

### 2.2 notes.json Structure
```typescript
interface TaskNode {
  id: string;              // UUID
  text: string;
  checked: boolean;
  indent: number;          // 0-based nesting
  children: TaskNode[];
  metadata?: {
    priority?: 'critical' | 'performance' | 'feature';
    blocked_by?: string[]; // Array of task IDs
    notes?: string;        // Claude's insights
  };
}

interface NotesFile {
  version: string;
  project_path: string;
  last_modified: number;
  tasks: TaskNode[];
}
```

### 2.3 Autosave Strategy
- Debounced save every 500ms on edit
- Atomic writes (write to temp → rename)
- No version history (keep simple)

---

## 3. CORE FEATURES - V1

### 3.1 Raw Input Mode

**UI:**
```
Plain textarea
- Monospace font (SF Mono)
- Autosave indicator
- Support -, *, or plain lines as bullets
- @filename.ts mention detection
```

**Implementation:**
```typescript
const [rawText, setRawText] = useState('');

// Detect @mentions
const mentions = useMemo(() => {
  return rawText.match(/@[\w\/\-\.]+/g) || [];
}, [rawText]);

// Debounced autosave
useEffect(() => {
  const timer = setTimeout(() => {
    ipcRenderer.send('save-raw', rawText);
  }, 500);
  return () => clearTimeout(timer);
}, [rawText]);
```

### 3.2 Context Gathering (@mentions)

When user types `@src/auth.ts`:
1. Resolve path relative to project root
2. Read file content
3. Parse imports/dependencies
4. Recursively load related files (max depth: 3)
5. Build context object for Claude

**Main process handler:**
```typescript
async function gatherContext(mentions: string[], projectRoot: string) {
  const files = new Map();

  for (const mention of mentions) {
    const resolvedPath = path.join(projectRoot, mention.slice(1));
    const content = await fs.readFile(resolvedPath, 'utf8');
    files.set(mention, content);

    // Parse imports and load dependencies
    const deps = parseImports(content, projectRoot);
    for (const dep of deps.slice(0, 10)) { // Limit 10 per file
      if (!files.has(dep)) {
        const depContent = await fs.readFile(dep, 'utf8');
        files.set(dep, depContent);
      }
    }
  }

  return files;
}
```

### 3.3 Format Button → Claude Analysis

**Trigger:** User clicks "Format with Claude"

**Process:**
1. Show loading state
2. Send raw text + context to Claude Agent SDK
3. Stream response
4. Parse structured output
5. Show preview with Accept/Edit/Cancel

**Prompt structure:**
```typescript
const systemPrompt = `You are a task analysis assistant for software developers.

Given raw bullet-point tasks and code context, you should:
1. Parse tasks into structured categories (CRITICAL, PERFORMANCE, FEATURES)
2. Identify dependencies and blockers
3. Detect missing tasks based on code context
4. Suggest reordering for logical execution
5. Flag potential issues

Output JSON matching this schema:
{
  sections: [{
    category: string,
    priority: string,
    tasks: [{
      text: string,
      notes: string[],
      blocked_by: string[],
      needs: string[]
    }]
  }],
  warnings: string[]
}

DO NOT include any text outside the JSON. Validate output is parseable.`;

async function formatWithClaude(rawText: string, context: Map<string, string>) {
  const contextStr = Array.from(context.entries())
    .map(([path, content]) => `File: ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  const prompt = `Raw tasks:
${rawText}

Context:
${contextStr}

Analyze and structure these tasks.`;

  const client = new ClaudeSDKClient({
    systemPrompt,
    maxTurns: 1,
    allowedTools: [] // No tools needed, just analysis
  });

  const response = await client.query(prompt);
  // Parse JSON from response
  return JSON.parse(response.content[0].text);
}
```

### 3.4 Checkbox Tree UI

**Features:**
- Tab/Shift+Tab for indent/outdent
- Click to toggle checked
- Collapsible sections (▼/▶ arrows)
- Inline edit on double-click
- Keyboard navigation (↑↓ to move, Space to toggle)

**React Component:**
```typescript
interface TaskTreeProps {
  tasks: TaskNode[];
  onUpdate: (tasks: TaskNode[]) => void;
}

function TaskTree({ tasks, onUpdate }: TaskTreeProps) {
  const handleKeyDown = (e: KeyboardEvent, nodeId: string) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      adjustIndent(nodeId, e.shiftKey ? -1 : 1);
    }
  };

  return (
    <div className="task-tree">
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onKeyDown={handleKeyDown}
        />
      ))}
    </div>
  );
}
```

---

## 4. STYLING

### 4.1 Color Palette
```css
--bg-primary: #1a1a1a;
--text-primary: #d4d4d4;
--text-dim: #808080;

--critical-bg: rgba(255, 80, 80, 0.15);
--critical-border: rgba(255, 80, 80, 0.5);

--perf-bg: rgba(255, 200, 80, 0.12);
--perf-border: rgba(255, 200, 80, 0.5);

--feature-bg: rgba(80, 200, 120, 0.1);
--feature-border: rgba(80, 200, 120, 0.4);
```

### 4.2 Typography
- Font: SF Mono, Menlo, Monaco (system monospace)
- Size: 13px base
- Line height: 1.6
- Letter spacing: -0.01em

### 4.3 Window Chrome
```typescript
const mainWindow = new BrowserWindow({
  width: 600,
  height: 800,
  minWidth: 400,
  minHeight: 500,
  titleBarStyle: 'hiddenInset', // macOS only
  vibrancy: 'ultra-dark',
  alwaysOnTop: false, // User toggle
  backgroundColor: '#1a1a1a'
});
```

---

## 5. PERFORMANCE

### 5.1 Rendering
- Virtual scrolling for >100 tasks
- Debounce text input handlers
- Memoize task tree rendering

### 5.2 Claude API Calls
- SDK includes automatic prompt caching
- Max tokens: 4000 per request
- Timeout: 30s
- Retry logic: 2 attempts with exponential backoff

### 5.3 Memory
- Clear context cache older than 7 days
- Limit @mention context to 50KB per file
- Stream large file reads

---

## 6. DEVELOPMENT WORKFLOW

### 6.1 Project Setup
```bash
npm init electron-app@latest project-stickies -- --template=webpack-typescript
cd project-stickies
npm install @anthropic-ai/claude-agent-sdk
npm install react react-dom
npm install -D tailwindcss postcss autoprefixer
```

### 6.2 Build Pipeline
```bash
npm run build     # Webpack + TS compile
npm run package   # electron-builder → .dmg
npm run make      # All platforms
```

### 6.3 Testing Strategy
**Phase 1 (MVP):**
- Manual testing only
- Focus on happy path

**Phase 2:**
- Unit tests for task parsing
- Integration tests for Claude API
- E2E with Playwright

---

## 7. DEPLOYMENT

### 7.1 Distribution
- Signed .dmg for macOS (Apple Developer cert required)
- Auto-updates via electron-updater (future)
- No app store initially (direct download)

### 7.2 First Launch
1. Prompt for project root selection
2. Auth setup (subscription login or API key)
3. Create ~/.project-stickies/
4. Show empty state

---

## 8. FUTURE ENHANCEMENTS (POST-V1)

- Claude Code integration for auto-implementation
- Multiple project tabs
- Export to markdown/CSV
- Sync across devices (optional cloud)
- Custom categories beyond 3 defaults
- Time estimates per task
- Supabase MCP for DB schema context

---

## 9. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Claude API rate limits | High | Use subscription auth, cache responses |
| Large bundle size | Medium | Aggressive tree-shaking, no heavy deps |
| Context window overflow | Medium | Limit file depth, truncate large files |
| File parsing errors | Low | Graceful fallback, show raw content |

---

## 10. SUCCESS METRICS

**V1 Launch Goals:**
- App launches in <2s
- Format operation completes in <10s
- Bundle size <80MB
- Zero crashes in 100 format operations
- User can complete full workflow in <2min

---

## 11. IMPLEMENTATION PHASES

**Week 1: Foundation**
- Electron shell
- Basic text input
- File storage

**Week 2: Claude Integration**
- SDK setup
- Context gathering
- Format button logic

**Week 3: UI Polish**
- Checkbox tree
- Styling
- Keyboard shortcuts

**Week 4: Testing & Packaging**
- Bug fixes
- Build pipeline
- Distribution prep

**Total: 4 weeks to MVP**

# oscribble

raw notes → structured tasks.
brutalist task manager. claude ai.

![oscribble interface](screenshot.png)

## what it does

- raw text becomes prioritized task lists
- voice input. toggle record `CMD+R`. transcribe via openai.
- `@mentions` load file context for smarter task analysis
- auto-context discovery. claude finds relevant files automatically.
- context tracking. see which files informed each task.
- task timing. automatic duration tracking for completed tasks.
- few-shot learning. time estimates improve from your completion history.
- hierarchical tasks. expand/collapse. arrow keys.
- multi-select tasks. `Shift+↑↓`. batch operations.
- dependency detection. blocked task flags.
- multi-project. quick switch `CMD+K`.
- keyboard-first. no mouse required.
- monochrome + orange. terminal aesthetic.

## install

download `.dmg` from [releases](https://github.com/oscargavin/oscribble/releases)

**macos security note:** unsigned app requires terminal command after install:
```bash
sudo xattr -cr /Applications/Oscribble.app
```
then launch normally. enter [anthropic api key](https://console.anthropic.com/) on first run.

### build from source

```bash
git clone https://github.com/oscargavin/oscribble.git
cd oscribble
npm install
npm start
```

requires node 18+, macos 11+

## use

write raw notes. `CMD+Enter` to format.
claude auto-discovers relevant project files.
`@filepath` mentions force specific files.
arrow keys navigate. `Shift+↑↓` multi-select.
`Space` toggles done. `CMD+O` shows context used.

### keyboard shortcuts

```
CMD+K       quick project switcher
CMD+1-9     switch to project (alphabetical)
CMD+T       toggle raw/tasks view
CMD+R       toggle voice recording
CMD+O       show context files (focused/selected tasks)
ESC         cancel recording

↑/↓         navigate
Shift+↑/↓   multi-select tasks
←/→         collapse/expand
Space       toggle complete (single/batch)
C           deselect all
N           new task
M           edit metadata
R           edit dependencies
Delete      remove task (single/batch)

1-5         filter: unchecked/complete/all/critical/blocked
```

## how it works

### intelligent context loading
when you format tasks, oscribble automatically:
1. scans your task text for `@filepath` mentions
2. discovers relevant files from your project (if no mentions)
3. caches file content (7-day expiry)
4. sends context to claude for smarter task analysis

see which files claude used: press `CMD+O` on any task.

### task timing & learning
complete a task → duration automatically logged.
next format → claude sees your completion history.
time estimates improve from your patterns (last 100 tasks).

active tasks show pulsing orange indicator.

### filtering & views
default view: unchecked tasks only.
press `1-5` to switch filters:
- `1` unchecked (active work)
- `2` completed (done)
- `3` all tasks
- `4` critical priority
- `5` blocked by dependencies

empty state shows helpful shortcuts.

## data

stored in `~/.project-stickies/`
```
settings.json         # api keys, current project
projects.json         # project registry
{project}/
  notes.json          # structured tasks
  raw.txt             # autosaved input
  completion_log.json # task timing history (last 100 completions)
  .context-cache/     # file context cache (7 day expiry)
```

## api keys

- anthropic (required): task formatting via claude
- openai (optional): voice transcription

get keys: [anthropic](https://console.anthropic.com/) • [openai](https://platform.openai.com/api-keys)

## dev

```bash
npm start           # dev mode, devtools open
npm run lint        # check typescript
npm run make        # build installer
```

electron + react + claude sonnet 4.5

## mcp integration

use oscribble from claude code. control tasks via natural language.

add to `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "oscribble": {
      "command": "npx",
      "args": ["-y", "@oscargavin/oscribble-mcp"]
    }
  }
}
```

ask claude code: "show unchecked tasks" • "complete task xyz" • "add task: fix auth bug"

[mcp docs](docs/mcp-integration.md) • [mcp repo](https://github.com/oscargavin/oscribble-mcp)

---

mit license.
not affiliated with anthropic. byok.

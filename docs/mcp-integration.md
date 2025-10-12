# MCP Integration for Oscribble

## Overview

The Oscribble MCP (Model Context Protocol) server provides Claude Code with a native interface to read and manipulate your Oscribble task data. This integration allows you to interact with your projects and tasks using natural language, directly from your Claude Code sessions.

## What You Can Do

With the MCP integration, you can:

- **List all your projects** - See all Oscribble projects with paths and last access times
- **View tasks** - List tasks from any project with filtering by completion status
- **Complete/uncomplete tasks** - Mark tasks as done or undone without opening the app
- **Get task details** - View full metadata including priority, blockers, and notes
- **Add raw tasks** - Append new tasks that will be formatted when you next open Oscribble

All of this works **even when the Oscribble app is closed**.

## Installation

### 1. Install Dependencies

```bash
cd ~/.config/oscribble-mcp
pip install -r requirements.txt
```

### 2. Configure Claude Code

Add the Oscribble server to your Claude Code MCP configuration:

**Location:** `~/.claude/claude-mcp.json` (or your Claude Code config location)

```json
{
  "mcpServers": {
    "oscribble": {
      "command": "python3",
      "args": ["/Users/YOUR_USERNAME/.config/oscribble-mcp/server.py"]
    }
  }
}
```

**Important:** Replace `YOUR_USERNAME` with your actual username, or use the full absolute path.

### 3. Restart Claude Code

After updating the configuration, restart Claude Code to load the new MCP server.

### 4. Verify Installation

In Claude Code, try: `"List my oscribble projects"`

If configured correctly, Claude will automatically use the `oscribble_list_projects` tool.

## Available Tools

### 1. `oscribble_list_projects`

Lists all your Oscribble projects with metadata.

**Parameters:** None

**Example usage:**
- "Show me all my oscribble projects"
- "What projects do I have in oscribble?"
- "List my oscribble projects sorted by recent"

**Output:**
```
**Oscribble Projects:**

- **oscribble**
  - Path: `/Users/oscar/Documents/projects/oscribble`
  - Last accessed: 1728750000000

- **tod**
  - Path: `/Users/oscar/Documents/projects/tod`
  - Last accessed: 1728740000000
```

---

### 2. `oscribble_list_tasks`

Lists tasks from a specific project with optional status filtering.

**Parameters:**
- `project_name` (required): Name of the project
- `filter_status` (optional): Filter by status - `"all"`, `"unchecked"`, or `"checked"` (default: `"all"`)

**Example usage:**
- "Show me all tasks in the oscribble project"
- "List unchecked tasks in tod"
- "What are the completed tasks in my edj project?"

**Output:**
```
**Tasks in 'oscribble' (filter: unchecked):**

☐ Implement MCP server [HIGH] (ID: abc-123-def)
  📝 Use Python with mcp SDK
  ☐ Create core tools (ID: sub-456-ghi)
  ☐ Write documentation (ID: sub-789-jkl)

☐ Test integration (ID: xyz-987-wvu)
  ⚠️ Blocked by: abc-123-def
```

---

### 3. `oscribble_complete_task`

Marks a task as complete.

**Parameters:**
- `project_name` (required): Name of the project
- `task_id` (required): UUID of the task to complete

**Example usage:**
- "Complete task abc-123-def in oscribble"
- "Mark task xyz-987 as done in the tod project"

**Output:**
```
✓ Task 'Implement MCP server' completed successfully in project 'oscribble'.
```

---

### 4. `oscribble_uncomplete_task`

Marks a task as incomplete.

**Parameters:**
- `project_name` (required): Name of the project
- `task_id` (required): UUID of the task to uncomplete

**Example usage:**
- "Uncomplete task abc-123-def in oscribble"
- "Mark task xyz-987 as not done"

**Output:**
```
✓ Task 'Implement MCP server' uncompleted successfully in project 'oscribble'.
```

---

### 5. `oscribble_get_task_details`

Gets detailed information about a specific task.

**Parameters:**
- `project_name` (required): Name of the project
- `task_id` (required): UUID of the task

**Example usage:**
- "Show me details for task abc-123-def"
- "What's the metadata on task xyz-987 in tod?"

**Output:**
```
**Task Details:**

**ID:** `abc-123-def`
**Text:** Implement MCP server
**Status:** ☐ Incomplete
**Priority:** HIGH
**Notes:** Use Python with mcp SDK

**Subtasks (2):**

  ☐ Create core tools (ID: sub-456-ghi)
  ☐ Write documentation (ID: sub-789-jkl)
```

---

### 6. `oscribble_add_raw_task`

Appends raw task text to a project's raw input file.

**Parameters:**
- `project_name` (required): Name of the project
- `task_text` (required): Raw task text to add

**Example usage:**
- "Add 'Fix bug in task tree' to oscribble project"
- "Create a task 'Review MCP docs' in tod"

**Output:**
```
✓ Added raw task to project 'oscribble'. It will be formatted next time you open Oscribble.
```

**Note:** The task will appear in Oscribble's raw input area and will be formatted by Claude API when you next click "Format with Claude" in the app.

## Natural Language Examples

Here are some example conversations you can have with Claude Code:

### Example 1: Quick Task Check
```
You: "What unchecked tasks do I have in oscribble?"

Claude: [calls oscribble_list_tasks("oscribble", "unchecked")]

You: "Complete the first one"

Claude: [calls oscribble_complete_task("oscribble", "abc-123")]
```

### Example 2: Cross-Project Overview
```
You: "Show me all my projects and tell me which ones have unchecked tasks"

Claude: [calls oscribble_list_projects(), then calls oscribble_list_tasks() for each project]
```

### Example 3: Quick Task Entry
```
You: "Add a task to review the MCP integration in my oscribble project"

Claude: [calls oscribble_add_raw_task("oscribble", "Review MCP integration")]
```

### Example 4: Task Investigation
```
You: "Why is task xyz-987 blocked?"

Claude: [calls oscribble_get_task_details("oscribble", "xyz-987")]
       [Shows task details including blocked_by field]
```

## Data Safety

### Atomic Writes

The MCP server uses the same atomic write pattern as the Oscribble app:
1. Write to temporary file in the same directory
2. Atomically rename temp file to target file

This prevents file corruption even if the process is interrupted.

### Concurrent Access

**Safe scenarios:**
- MCP server reads while Oscribble app is open (read-only operations)
- MCP server writes while Oscribble app is closed
- Oscribble app reads/writes while MCP server is idle

**Potential issues:**
- Both MCP server and Oscribble app write at the exact same time
  - **Mitigation:** The atomic write pattern means one will win, but data won't be corrupted
  - **Best practice:** Close Oscribble before making bulk changes via MCP

### File Locations

All data is stored in `~/.project-stickies/`:
```
~/.project-stickies/
├── settings.json         # App settings (API key, current project)
├── projects.json         # Project registry (read by MCP)
└── {project-name}/
    ├── notes.json        # Structured tasks (read/write by MCP)
    └── raw.txt           # Raw input text (append by MCP)
```

The MCP server **never** modifies:
- `settings.json` (API key and app settings)
- Project paths or registry structure

## Troubleshooting

### "No projects found"

**Cause:** The `~/.project-stickies/projects.json` file doesn't exist yet.

**Solution:** Open Oscribble app and create at least one project.

---

### "Project 'xyz' not found"

**Cause:** The project name doesn't match any entry in `projects.json`.

**Solution:**
1. Run `oscribble_list_projects` to see exact project names
2. Use the exact name (case-sensitive)

---

### "File not found" for notes.json

**Cause:** The project exists but has no tasks yet.

**Solution:** Open the project in Oscribble and format at least once, or use `oscribble_add_raw_task` to add tasks.

---

### MCP server not responding

**Debugging steps:**
1. Check if Python path is correct in config
2. Try running server manually:
   ```bash
   python3 ~/.config/oscribble-mcp/server.py
   ```
3. Check Claude Code logs for MCP errors
4. Verify `mcp` package is installed:
   ```bash
   pip list | grep mcp
   ```

---

### Task IDs are UUIDs - hard to remember

**Solution:** You don't need to remember them! Just describe the task:

```
You: "Complete the task about MCP integration in oscribble"

Claude: [searches tasks, finds matching ID, completes it]
```

Claude Code will search through your tasks to find the right one based on your description.

## Architecture Notes

### Why MCP?

MCP provides several advantages over other integration approaches:

1. **Native Discovery:** Claude Code automatically discovers and documents tools
2. **Type Safety:** Schemas are validated automatically
3. **Separation of Concerns:** MCP server is independent of Electron app
4. **Reusable:** Works with any MCP-compatible client, not just Claude Code
5. **No Dependencies:** Electron app doesn't need to be running

### Design Decisions

**Python over TypeScript:**
- Faster to implement (~150 lines of Python vs ~300+ lines of TS)
- MCP Python SDK is mature and well-documented
- No build step required
- Easy to install (`pip install mcp`)

**Read-heavy, Write-light:**
- Most operations are reads (list projects, list tasks, get details)
- Writes use atomic pattern to prevent corruption
- No need for file locking (atomic rename is OS-level atomic)

**Task IDs as UUIDs:**
- Oscribble already generates UUIDs for all tasks
- Allows direct addressing without path traversal
- Reusing existing IDs means no migration needed

## Future Enhancements

Potential additions to the MCP server:

1. **Search Tool:** `oscribble_search_tasks(query)` - Full-text search across all projects
2. **Bulk Operations:** `oscribble_complete_multiple_tasks([task_ids])`
3. **Priority Updates:** `oscribble_update_task_priority(task_id, priority)`
4. **Dependency Management:** `oscribble_add_blocker(task_id, blocked_by_id)`
5. **Project Creation:** `oscribble_create_project(name, path)`
6. **Statistics:** `oscribble_get_stats(project_name)` - Task counts, completion rates

These can be added incrementally as the integration is used and feedback is gathered.

## Related Documentation

- [Oscribble Architecture](../CLAUDE.md) - Main project documentation
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/) - Official MCP docs
- [Claude Code MCP Guide](https://docs.claude.com/claude-code/mcp) - Integration guide

## Support

For issues or feature requests:
1. Check this documentation first
2. Verify your Claude Code MCP configuration
3. Test the server manually with `python3 server.py`
4. Open an issue in the Oscribble repository

---

**Last Updated:** October 12, 2025

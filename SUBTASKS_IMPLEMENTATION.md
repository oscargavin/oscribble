# Subtasks Expand/Collapse Implementation Guide

## Overview
This document describes the changes needed to add expand/collapse functionality for subtasks in the TaskTree component.

## File to Modify
`/Users/oscargavin/Documents/projects/oscribble/src/components/TaskTree.tsx`

## Changes Required

### 1. Update TaskRowProps Interface (line 11-19)

Add these new props:
```typescript
interface TaskRowProps {
  task: TaskNode;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndentChange: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onMetadataChange: (id: string, metadata: TaskNode['metadata']) => void;
  isFocused: boolean;
  // NEW PROPS FOR SUBTASKS:
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  expandedTasks: Set<string>;
  depth?: number;  // Track nesting depth for proper indentation
}
```

### 2. Update TaskRow Component (starting at line 21)

Modify the component signature to accept new props:
```typescript
const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggle,
  onTextChange,
  onIndentChange,
  onDelete,
  onMetadataChange,
  isFocused,
  // NEW:
  isExpanded,
  onToggleExpand,
  expandedTasks,
  depth = 0,
}) => {
```

### 3. Add Subtask Check (after getPriorityStyles function, around line 130)

```typescript
const hasSubtasks = task.subtasks && task.subtasks.length > 0;
```

### 4. Update the Task Row Container (line 132-141)

Modify the `style` prop to account for depth:
```typescript
style={{
  marginLeft: `${(task.indent + depth) * 20}px`,
  borderLeft: !isFocused && (task.indent + depth) > 0 ? '1px solid #222222' : undefined
}}
```

### 5. Replace Static Arrow with Expandable Indicator (line 163-168)

Replace:
```typescript
<div className="flex gap-2">
  <span className="text-[#FF4D00] flex-shrink-0">▸</span>
  <span className={...}>
    {task.text}
  </span>
</div>
```

With:
```typescript
<div className="flex gap-2 items-center">
  {hasSubtasks ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleExpand(task.id);
      }}
      className="text-[#FF4D00] flex-shrink-0 hover:text-[#E6E6E6] transition-colors"
      title={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
    >
      {isExpanded ? '▾' : '▸'}
    </button>
  ) : (
    <span className="text-[#FF4D00] flex-shrink-0">▸</span>
  )}
  <span className={`text-sm font-mono ${task.checked ? 'line-through text-[#666666]' : 'text-[#E6E6E6]'}`}>
    {task.text}
  </span>
  {hasSubtasks && (
    <span className="text-xs text-[#666666] font-mono">
      [{task.subtasks!.length}]
    </span>
  )}
</div>
```

### 6. Add Subtasks Rendering (after the main task div closes, around line 281)

Wrap the return in a fragment and add subtask rendering:
```typescript
return (
  <>
    <div
      data-task-id={task.id}
      className={...}
      // ... existing props
    >
      {/* Existing task content */}
    </div>

    {/* NEW: Render subtasks if expanded */}
    {isExpanded && hasSubtasks && (
      <>
        {task.subtasks!.map((subtask) => (
          <TaskRow
            key={subtask.id}
            task={subtask}
            onToggle={onToggle}
            onTextChange={onTextChange}
            onIndentChange={onIndentChange}
            onDelete={onDelete}
            onMetadataChange={onMetadataChange}
            isFocused={false}
            isExpanded={expandedTasks.has(subtask.id)}
            onToggleExpand={onToggleExpand}
            expandedTasks={expandedTasks}
            depth={depth + 1}
          />
        ))}
      </>
    )}
  </>
);
```

### 7. Add Expanded State to TaskTree (line 288)

```typescript
const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
const [isCreating, setIsCreating] = useState(false);
const [newTaskText, setNewTaskText] = useState('');
const [filterMode, setFilterMode] = useState<FilterMode>('all');
// NEW:
const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
```

### 8. Update flattenTasks Function (line 296)

```typescript
const flattenTasks = (taskList: TaskNode[], currentExpanded: Set<string> = expandedTasks): TaskNode[] => {
  const result: TaskNode[] = [];
  for (const task of taskList) {
    result.push(task);
    // Include subtasks if expanded
    if (task.subtasks && task.subtasks.length > 0 && currentExpanded.has(task.id)) {
      result.push(...flattenTasks(task.subtasks, currentExpanded));
    }
    // Include hierarchical children
    if (task.children.length > 0) {
      result.push(...flattenTasks(task.children, currentExpanded));
    }
  }
  return result;
};
```

### 9. Add Toggle Expand Handler (after clearAllTasks, around line 381)

```typescript
const handleToggleExpand = (id: string) => {
  setExpandedTasks((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return newSet;
  });
};
```

### 10. Add Arrow Left/Right Keyboard Shortcuts (in useEffect handleKeyDown, after line 435)

Add these before the Space key handler:
```typescript
// ArrowRight to expand
else if (e.key === 'ArrowRight' && focusedTaskId) {
  e.preventDefault();
  const task = flatTasks.find(t => t.id === focusedTaskId);
  if (task && task.subtasks && task.subtasks.length > 0) {
    if (!expandedTasks.has(focusedTaskId)) {
      handleToggleExpand(focusedTaskId);
    }
  }
}
// ArrowLeft to collapse
else if (e.key === 'ArrowLeft' && focusedTaskId) {
  e.preventDefault();
  const task = flatTasks.find(t => t.id === focusedTaskId);
  if (task && task.subtasks && task.subtasks.length > 0) {
    if (expandedTasks.has(focusedTaskId)) {
      handleToggleExpand(focusedTaskId);
    }
  }
}
```

### 11. Update useEffect Dependencies (line 468)

```typescript
}, [focusedTaskId, displayTasks, flatTasks, tasks, expandedTasks]);
```

### 12. Update All Recursive Handlers to Include Subtasks

In `handleToggle`, `handleTextChange`, `handleIndentChange`, `handleDelete`, and `handleMetadataChange`, add subtask handling:

```typescript
// Example for handleToggle (add similar to others):
const toggleRecursive = (taskList: TaskNode[]): TaskNode[] => {
  return taskList.map((task) => {
    if (task.id === id) {
      return { ...task, checked: !task.checked };
    }
    if (task.children.length > 0) {
      return { ...task, children: toggleRecursive(task.children) };
    }
    // NEW: Also check subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      return { ...task, subtasks: toggleRecursive(task.subtasks) };
    }
    return task;
  });
};
```

### 13. Update TaskRow Rendering in map (currently line 638)

Change from:
```typescript
{tasks.map((task) => (
  <TaskRow
    key={task.id}
    task={task}
    onToggle={handleToggle}
    onTextChange={handleTextChange}
    onIndentChange={handleIndentChange}
    onDelete={handleDelete}
    onMetadataChange={handleMetadataChange}
    isFocused={task.id === focusedTaskId}
  />
))}
```

To:
```typescript
{tasks.map((task) => (
  <TaskRow
    key={task.id}
    task={task}
    onToggle={handleToggle}
    onTextChange={handleTextChange}
    onIndentChange={handleIndentChange}
    onDelete={handleDelete}
    onMetadataChange={handleMetadataChange}
    isFocused={task.id === focusedTaskId}
    isExpanded={expandedTasks.has(task.id)}
    onToggleExpand={handleToggleExpand}
    expandedTasks={expandedTasks}
  />
))}
```

### 14. Add Keyboard Shortcut Hint (in the keyboard hints section)

Add after the NAV hint:
```typescript
<div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
  <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">←</kbd>
  <span className="text-[#666666]">/</span>
  <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">→</kbd>
  <span className="text-[#888888] text-xs font-mono uppercase">EXPAND</span>
</div>
```

## Summary of Changes

### Visual Changes:
- Tasks with subtasks show ▸ (collapsed) or ▾ (expanded) with a clickable button
- Subtask count badge `[N]` shows number of subtasks
- Subtasks are indented an additional 20px per nesting level
- Subtasks respect the same styling as parent tasks

### Keyboard Shortcuts Added:
- `←` (Left Arrow): Collapse subtasks for focused task
- `→` (Right Arrow): Expand subtasks for focused task

### Edge Cases Handled:
- Tasks without subtasks show static ▸ indicator (no click action)
- Expanded state persists until manually collapsed
- Navigation (up/down arrows) respects expanded state
- All CRUD operations (toggle, edit, delete) work recursively through subtasks
- Subtasks can have their own subtasks (recursive nesting)
- Focus state is not applied to subtasks (only parent tasks)

## Testing Checklist:
- [ ] Tasks with subtasks show expand/collapse indicator
- [ ] Clicking indicator toggles expanded state
- [ ] Arrow right expands, arrow left collapses when task has focus
- [ ] Subtasks render with proper indentation
- [ ] Keyboard navigation includes expanded subtasks
- [ ] Deleting a parent task deletes subtasks
- [ ] Checking a parent task checks subtasks (if desired behavior)
- [ ] Subtasks can have their own subtasks
- [ ] Filter modes work correctly with expanded subtasks

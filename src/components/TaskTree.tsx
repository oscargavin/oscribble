import React, { useState, useEffect, useRef } from 'react';
import { TaskNode } from '../types';
import { Checkbox } from './ui/checkbox';

interface TaskTreeProps {
  tasks: TaskNode[];
  onUpdate: (tasks: TaskNode[]) => void;
}

interface TaskRowProps {
  task: TaskNode;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndentChange: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  isFocused: boolean;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggle,
  onTextChange,
  onIndentChange,
  onDelete,
  isFocused,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(task.text);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editText !== task.text) {
      onTextChange(task.id, editText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(task.text);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onIndentChange(task.id, e.shiftKey ? -1 : 1);
    }
  };

  const handleCopy = async () => {
    // Format the task content for copying
    let copyText = task.text;

    // Add priority if present
    if (task.metadata?.priority) {
      copyText += `\nPriority: ${task.metadata.priority}`;
    }

    // Add notes if present
    if (task.metadata?.notes) {
      copyText += `\nNotes: ${task.metadata.notes}`;
    }

    // Add blocked_by if present
    if (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) {
      copyText += `\nBlocked by: ${task.metadata.blocked_by.join(', ')}`;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getPriorityStyles = () => {
    switch (task.metadata?.priority) {
      case 'critical':
        return 'border-l-2 border-l-[#FF4D00]';
      case 'performance':
        return 'border-l-2 border-l-[#E6E6E6]';
      case 'feature':
        return 'border-l-2 border-l-[#555555]';
      default:
        return '';
    }
  };

  return (
    <div
      data-task-id={task.id}
      className={`flex items-start gap-3 p-3 border-b border-[#111111] hover:bg-[#0A0A0A] transition-colors duration-150 relative group ${getPriorityStyles()} ${isFocused ? 'border border-[#FF4D00] bg-[#FF4D00]/5' : ''}`}
      style={{
        marginLeft: `${task.indent * 20}px`,
        borderLeft: !isFocused && task.indent > 0 ? '1px solid #222222' : undefined
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Checkbox
        checked={task.checked}
        onCheckedChange={() => onToggle(task.id)}
        className="mt-1 cursor-pointer"
      />

      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 bg-[#0A0A0A] text-[#E6E6E6] px-2 py-1 border border-[#FF4D00] outline-none text-sm font-mono"
        />
      ) : (
        <div
          className="flex-1 cursor-pointer"
          onDoubleClick={handleDoubleClick}
        >
          <div className="flex gap-2">
            <span className="text-[#FF4D00] flex-shrink-0">▸</span>
            <span className={`text-sm font-mono ${task.checked ? 'line-through text-[#666666]' : 'text-[#E6E6E6]'}`}>
              {task.text}
            </span>
          </div>
          {task.metadata?.notes && (
            <div className="text-xs text-[#888888] mt-1 font-mono pl-4 space-y-1 border-l border-[#333333]">
              {task.metadata.notes.split(', ').map((note, index) => (
                <div key={index} className="pl-2">- {note}</div>
              ))}
            </div>
          )}
          {task.metadata?.blocked_by && task.metadata.blocked_by.length > 0 && (
            <div className="text-xs text-[#FF4D00] mt-1 font-mono pl-4 border-l border-[#FF4D00]">
              [BLOCKED] {task.metadata.blocked_by.join(', ')}
            </div>
          )}
        </div>
      )}

      {task.metadata?.priority && (
        <span className="text-xs px-2 py-1 border border-[#E6E6E6] bg-transparent text-[#E6E6E6] font-mono uppercase tracking-wider ml-auto">
          {task.metadata.priority}
        </span>
      )}

      {isHovered && !isEditing && (
        <div className="absolute right-3 bottom-3 flex gap-1">
          <button
            onClick={handleCopy}
            className="text-[#E6E6E6] hover:text-[#FF4D00] transition-colors duration-150 p-1 border border-[#E6E6E6] hover:border-[#FF4D00] bg-[#000000]"
            title={isCopied ? "Copied!" : "Copy task to clipboard"}
          >
            {isCopied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#FF4D00]"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="text-[#E6E6E6] hover:text-[#FF4D00] transition-colors duration-150 p-1 border border-[#E6E6E6] hover:border-[#FF4D00] bg-[#000000]"
            title="Delete task"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export const TaskTree: React.FC<TaskTreeProps> = ({ tasks, onUpdate }) => {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Flatten tasks for navigation
  const flattenTasks = (taskList: TaskNode[]): TaskNode[] => {
    const result: TaskNode[] = [];
    for (const task of taskList) {
      result.push(task);
      if (task.children.length > 0) {
        result.push(...flattenTasks(task.children));
      }
    }
    return result;
  };

  const flatTasks = flattenTasks(tasks);

  // Copy task to clipboard
  const copyTaskToClipboard = async (task: TaskNode) => {
    let copyText = task.text;
    if (task.metadata?.priority) {
      copyText += `\nPriority: ${task.metadata.priority}`;
    }
    if (task.metadata?.notes) {
      copyText += `\nNotes: ${task.metadata.notes}`;
    }
    if (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) {
      copyText += `\nBlocked by: ${task.metadata.blocked_by.join(', ')}`;
    }
    try {
      await navigator.clipboard.writeText(copyText);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Copy all tasks to clipboard
  const copyAllTasks = async () => {
    const allTasksText = flatTasks.map(task => {
      let text = task.text;
      if (task.metadata?.priority) {
        text += ` [${task.metadata.priority}]`;
      }
      return text;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(allTasksText);
    } catch (err) {
      console.error('Failed to copy all:', err);
    }
  };

  // Clear all tasks
  const clearAllTasks = () => {
    if (window.confirm('Are you sure you want to clear all tasks?')) {
      onUpdate([]);
      setFocusedTaskId(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when container is mounted and not in an input
      if (!containerRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Arrow navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!focusedTaskId && flatTasks.length > 0) {
          setFocusedTaskId(flatTasks[0].id);
        } else if (focusedTaskId) {
          const currentIndex = flatTasks.findIndex(t => t.id === focusedTaskId);
          if (currentIndex < flatTasks.length - 1) {
            setFocusedTaskId(flatTasks[currentIndex + 1].id);
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focusedTaskId) {
          const currentIndex = flatTasks.findIndex(t => t.id === focusedTaskId);
          if (currentIndex > 0) {
            setFocusedTaskId(flatTasks[currentIndex - 1].id);
          }
        }
      }
      // Space to toggle
      else if (e.key === ' ' && focusedTaskId) {
        e.preventDefault();
        handleToggle(focusedTaskId);
      }
      // Delete key
      else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedTaskId) {
        e.preventDefault();
        handleDelete(focusedTaskId);
      }
      // Cmd+C to copy focused task
      else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && focusedTaskId && !e.shiftKey) {
        const task = flatTasks.find(t => t.id === focusedTaskId);
        if (task) {
          e.preventDefault();
          copyTaskToClipboard(task);
        }
      }
      // Cmd+Shift+C to copy all tasks
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        copyAllTasks();
      }
      // Cmd+L to clear all
      else if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        clearAllTasks();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedTaskId, flatTasks, tasks]);

  // Scroll focused task into view
  useEffect(() => {
    if (focusedTaskId) {
      const element = document.querySelector(`[data-task-id="${focusedTaskId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedTaskId]);

  const handleToggle = (id: string) => {
    const toggleRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.map((task) => {
        if (task.id === id) {
          return { ...task, checked: !task.checked };
        }
        if (task.children.length > 0) {
          return { ...task, children: toggleRecursive(task.children) };
        }
        return task;
      });
    };
    onUpdate(toggleRecursive(tasks));
  };

  const handleTextChange = (id: string, text: string) => {
    const updateRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.map((task) => {
        if (task.id === id) {
          return { ...task, text };
        }
        if (task.children.length > 0) {
          return { ...task, children: updateRecursive(task.children) };
        }
        return task;
      });
    };
    onUpdate(updateRecursive(tasks));
  };

  const handleIndentChange = (id: string, delta: number) => {
    const updateRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.map((task) => {
        if (task.id === id) {
          const newIndent = Math.max(0, task.indent + delta);
          return { ...task, indent: newIndent };
        }
        if (task.children.length > 0) {
          return { ...task, children: updateRecursive(task.children) };
        }
        return task;
      });
    };
    onUpdate(updateRecursive(tasks));
  };

  const handleDelete = (id: string) => {
    const deleteRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.filter((task) => {
        if (task.id === id) {
          return false;
        }
        if (task.children.length > 0) {
          task.children = deleteRecursive(task.children);
        }
        return true;
      });
    };
    onUpdate(deleteRecursive(tasks));
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#666666] text-sm font-mono uppercase tracking-wider">
        [NO TASKS] USE FORMAT TO GENERATE
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="flex-1 overflow-auto py-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={handleToggle}
            onTextChange={handleTextChange}
            onIndentChange={handleIndentChange}
            onDelete={handleDelete}
            isFocused={task.id === focusedTaskId}
          />
        ))}
      </div>

      {/* Keyboard shortcut hints */}
      <div className="flex items-center gap-4 p-3 border-t border-[#222222] overflow-x-auto flex-nowrap bg-[#0A0A0A]">
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">↑</kbd>
          <span className="text-[#666666]">/</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">↓</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">NAV</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">SPACE</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">TOGGLE</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">DEL</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">DELETE</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">C</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">COPY</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">SHIFT</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">C</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">COPY ALL</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">L</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">CLEAR</span>
        </div>
      </div>
    </div>
  );
};

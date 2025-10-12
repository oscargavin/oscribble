import React, { useState, useEffect, useRef } from 'react';
import { TaskNode } from '../types';
import { Checkbox } from './ui/checkbox';
import { v4 as uuidv4 } from 'uuid';

interface TaskTreeProps {
  tasks: TaskNode[];
  onUpdate: (tasks: TaskNode[]) => void;
  projectRoot: string;
}

interface RelationshipEditorProps {
  task: TaskNode;
  allTasks: TaskNode[];
  onSave: (taskId: string, dependsOn: string[], relatedTo: string[]) => void;
  onClose: () => void;
}

const RelationshipEditor: React.FC<RelationshipEditorProps> = ({
  task,
  allTasks,
  onSave,
  onClose,
}) => {
  const [dependsOnInput, setDependsOnInput] = useState('');
  const [relatedToInput, setRelatedToInput] = useState('');

  // Create a numbered list of all tasks
  const numberedTasks = allTasks.map((t, index) => ({
    number: index + 1,
    id: t.id,
    text: t.text,
  }));

  // Find current task's relationships and convert to numbers
  useEffect(() => {
    const taskToNumber = (taskId: string): number | null => {
      const index = allTasks.findIndex(t => t.id === taskId);
      return index >= 0 ? index + 1 : null;
    };

    if (task.metadata?.depends_on) {
      const numbers = task.metadata.depends_on
        .map(taskToNumber)
        .filter((n): n is number => n !== null);
      setDependsOnInput(numbers.join(', '));
    }

    if (task.metadata?.related_to) {
      const numbers = task.metadata.related_to
        .map(taskToNumber)
        .filter((n): n is number => n !== null);
      setRelatedToInput(numbers.join(', '));
    }
  }, [task, allTasks]);

  const handleSave = () => {
    // Parse input strings to numbers, then convert to task IDs
    const parseNumbers = (input: string): string[] => {
      if (!input.trim()) return [];

      const numbers = input
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= allTasks.length);

      return numbers.map(n => allTasks[n - 1].id);
    };

    const dependsOn = parseNumbers(dependsOnInput);
    const relatedTo = parseNumbers(relatedToInput);

    onSave(task.id, dependsOn, relatedTo);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-black border-2 border-[#FF4D00] w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#FF4D00]">
          <h2 className="text-[#E6E6E6] font-mono text-sm uppercase tracking-wider mb-2">
            [EDIT RELATIONSHIPS]
          </h2>
          <p className="text-[#888888] font-mono text-xs">
            {task.text}
          </p>
        </div>

        {/* Task list */}
        <div className="p-4 border-b border-[#333333] overflow-auto max-h-[200px]">
          <h3 className="text-[#E6E6E6] font-mono text-xs uppercase tracking-wider mb-2">
            ALL TASKS:
          </h3>
          <div className="space-y-1">
            {numberedTasks.map(({ number, id, text }) => (
              <div
                key={id}
                className={`text-xs font-mono ${
                  id === task.id ? 'text-[#FF4D00]' : 'text-[#888888]'
                }`}
              >
                {number}. {text} {id === task.id ? '(current)' : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Input fields */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[#E6E6E6] font-mono text-xs uppercase tracking-wider block mb-2">
              DEPENDS ON (comma-separated numbers):
            </label>
            <input
              type="text"
              value={dependsOnInput}
              onChange={(e) => setDependsOnInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 1, 3, 5"
              className="w-full bg-transparent text-[#E6E6E6] px-3 py-2 border border-[#E6E6E6] outline-none text-sm font-mono focus:border-[#FF4D00]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[#E6E6E6] font-mono text-xs uppercase tracking-wider block mb-2">
              RELATED TO (comma-separated numbers):
            </label>
            <input
              type="text"
              value={relatedToInput}
              onChange={(e) => setRelatedToInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 2, 4"
              className="w-full bg-transparent text-[#E6E6E6] px-3 py-2 border border-[#E6E6E6] outline-none text-sm font-mono focus:border-[#FF4D00]"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 border border-[#E6E6E6] text-[#E6E6E6] hover:border-[#FF4D00] hover:text-[#FF4D00] transition-colors uppercase font-mono text-xs tracking-wider"
            >
              [ENTER] SAVE
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[#666666] text-[#666666] hover:border-[#E6E6E6] hover:text-[#E6E6E6] transition-colors uppercase font-mono text-xs tracking-wider"
            >
              [ESC] CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TaskRowProps {
  task: TaskNode;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndentChange: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onMetadataChange: (id: string, metadata: TaskNode['metadata']) => void;
  onFormat: (id: string) => void;
  onFocus: (id: string) => void;
  isFocused: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  expandedTasks: Set<string>;
  isFormattingTaskId: string | null;
  depth?: number;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggle,
  onTextChange,
  onIndentChange,
  onDelete,
  onMetadataChange,
  onFormat,
  onFocus,
  isFocused,
  isExpanded,
  onToggleExpand,
  expandedTasks,
  isFormattingTaskId,
  depth = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [metadataForm, setMetadataForm] = useState({
    deadline: task.metadata?.deadline || '',
    effort_estimate: task.metadata?.effort_estimate || '',
    tags: task.metadata?.tags?.join(', ') || '',
  });

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

  const handleMetadataEdit = () => {
    setIsEditingMetadata(true);
    setMetadataForm({
      deadline: task.metadata?.deadline || '',
      effort_estimate: task.metadata?.effort_estimate || '',
      tags: task.metadata?.tags?.join(', ') || '',
    });
  };

  const handleMetadataSave = () => {
    const updatedMetadata = {
      ...task.metadata,
      deadline: metadataForm.deadline.trim() || undefined,
      effort_estimate: metadataForm.effort_estimate.trim() || undefined,
      tags: metadataForm.tags.trim()
        ? metadataForm.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : undefined,
    };

    onMetadataChange(task.id, updatedMetadata);
    setIsEditingMetadata(false);
  };

  const handleMetadataCancel = () => {
    setIsEditingMetadata(false);
    setMetadataForm({
      deadline: task.metadata?.deadline || '',
      effort_estimate: task.metadata?.effort_estimate || '',
      tags: task.metadata?.tags?.join(', ') || '',
    });
  };

  const handleMetadataKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMetadataSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleMetadataCancel();
    }
  };

  // Listen for keyboard shortcut to trigger metadata edit
  useEffect(() => {
    if (isFocused && !isEditing && !isEditingMetadata) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'm' || e.key === 'M') && e.target === document.body) {
          e.preventDefault();
          handleMetadataEdit();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFocused, isEditing, isEditingMetadata]);

  const handleCopy = async () => {
    // Format the task content for copying
    let copyText = task.text;

    // Add priority if present
    if (task.metadata?.priority) {
      copyText += `\nPriority: ${task.metadata.priority}`;
    }

    // Add notes if present (now an array)
    if (task.metadata?.notes && task.metadata.notes.length > 0) {
      copyText += `\nNotes:\n${task.metadata.notes.map(note => `  - ${note}`).join('\n')}`;
    }

    // Add deadline if present
    if (task.metadata?.deadline) {
      copyText += `\nDeadline: ${task.metadata.deadline}`;
    }

    // Add effort estimate if present
    if (task.metadata?.effort_estimate) {
      copyText += `\nEstimate: ${task.metadata.effort_estimate}`;
    }

    // Add tags if present
    if (task.metadata?.tags && task.metadata.tags.length > 0) {
      copyText += `\nTags: ${task.metadata.tags.join(', ')}`;
    }

    // Add blocked_by if present
    if (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) {
      copyText += `\nBlocked by: ${task.metadata.blocked_by.join(', ')}`;
    }

    // Add depends_on if present
    if (task.metadata?.depends_on && task.metadata.depends_on.length > 0) {
      copyText += `\nDepends on: ${task.metadata.depends_on.join(', ')}`;
    }

    // Add related_to if present
    if (task.metadata?.related_to && task.metadata.related_to.length > 0) {
      copyText += `\nRelated: ${task.metadata.related_to.join(', ')}`;
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

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  const isRawTask = task.metadata?.formatted === false;

  return (
    <>
    <div
      data-task-id={task.id}
      className={`flex items-start gap-3 p-3 border-b border-[#111111] hover:bg-[#0A0A0A] transition-colors duration-150 relative group cursor-pointer ${getPriorityStyles()} ${isFocused ? 'border border-[#FF4D00] bg-[#FF4D00]/5' : ''}`}
      style={{
        marginLeft: `${(task.indent + depth) * 20}px`,
        borderLeft: !isFocused && (task.indent + depth) > 0 ? '1px solid #222222' : undefined,
        minHeight: isRawTask ? '96px' : undefined, // Extra height for raw tasks to fit buttons below badges
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        // Don't trigger focus if clicking on interactive elements
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLButtonElement ||
          (e.target as HTMLElement).closest('button')
        ) {
          return;
        }
        // Focus this task
        onFocus(task.id);
      }}
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
      ) : isEditingMetadata ? (
        <div className="flex-1 space-y-2 py-1">
          <div className="flex items-center gap-2">
            <label className="text-[#E6E6E6] text-xs font-mono w-16">DUE:</label>
            <input
              type="text"
              value={metadataForm.deadline}
              onChange={(e) => setMetadataForm({ ...metadataForm, deadline: e.target.value })}
              onKeyDown={handleMetadataKeyDown}
              placeholder="e.g., 2024-12-31, next week"
              className="flex-1 bg-transparent text-[#E6E6E6] px-2 py-1 border border-[#FF4D00] outline-none text-xs font-mono"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#E6E6E6] text-xs font-mono w-16">EST:</label>
            <input
              type="text"
              value={metadataForm.effort_estimate}
              onChange={(e) => setMetadataForm({ ...metadataForm, effort_estimate: e.target.value })}
              onKeyDown={handleMetadataKeyDown}
              placeholder="e.g., 2h, 1d, 30min"
              className="flex-1 bg-transparent text-[#E6E6E6] px-2 py-1 border border-[#FF4D00] outline-none text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#E6E6E6] text-xs font-mono w-16">TAGS:</label>
            <input
              type="text"
              value={metadataForm.tags}
              onChange={(e) => setMetadataForm({ ...metadataForm, tags: e.target.value })}
              onKeyDown={handleMetadataKeyDown}
              placeholder="e.g., urgent, backend, bug"
              className="flex-1 bg-transparent text-[#E6E6E6] px-2 py-1 border border-[#FF4D00] outline-none text-xs font-mono"
            />
          </div>
          <div className="flex gap-2 text-xs font-mono">
            <button
              onClick={handleMetadataSave}
              className="px-2 py-1 border border-[#E6E6E6] text-[#E6E6E6] hover:border-[#FF4D00] hover:text-[#FF4D00] transition-colors uppercase"
            >
              [ENTER] SAVE
            </button>
            <button
              onClick={handleMetadataCancel}
              className="px-2 py-1 border border-[#666666] text-[#666666] hover:border-[#E6E6E6] hover:text-[#E6E6E6] transition-colors uppercase"
            >
              [ESC] CANCEL
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 cursor-pointer"
          onDoubleClick={handleDoubleClick}
        >
          <div className="flex gap-2 items-start">
            {hasSubtasks ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(task.id);
                }}
                className="text-[#FF4D00] flex-shrink-0 hover:text-[#E6E6E6] transition-colors leading-none mt-[2px]"
                title={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="text-[#FF4D00] flex-shrink-0 leading-none mt-[2px]">▸</span>
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
          {task.metadata?.notes && task.metadata.notes.length > 0 && (
            <div className="text-xs text-[#888888] mt-1 font-mono pl-4 space-y-1 border-l border-[#333333]">
              {task.metadata.notes.map((note, index) => (
                <div key={index} className="pl-2">- {note}</div>
              ))}
            </div>
          )}
          {task.metadata?.blocked_by && task.metadata.blocked_by.length > 0 && (
            <div className="text-xs text-[#FF4D00] mt-1 font-mono pl-4 border-l border-[#FF4D00]">
              [BLOCKED] {task.metadata.blocked_by.join(', ')}
            </div>
          )}
          {task.metadata?.depends_on && task.metadata.depends_on.length > 0 && (
            <div className="text-xs text-[#888888] mt-1 font-mono pl-4 border-l border-[#888888]">
              [DEPENDS] {task.metadata.depends_on.join(', ')}
            </div>
          )}
          {task.metadata?.related_to && task.metadata.related_to.length > 0 && (
            <div className="text-xs text-[#666666] mt-1 font-mono pl-4 border-l border-[#666666]">
              [RELATED] {task.metadata.related_to.join(', ')}
            </div>
          )}
          {(task.metadata?.deadline || task.metadata?.effort_estimate) && (
            <div className="flex gap-3 mt-1 pl-4 text-xs font-mono">
              {task.metadata.deadline && (
                <span className="text-[#E6E6E6]">DUE: {task.metadata.deadline}</span>
              )}
              {task.metadata.effort_estimate && (
                <span className="text-[#888888]">EST: {task.metadata.effort_estimate}</span>
              )}
            </div>
          )}
          {task.metadata?.tags && task.metadata.tags.length > 0 && (
            <div className="flex gap-2 mt-1 pl-4">
              {task.metadata.tags.map((tag, index) => (
                <span key={index} className="text-xs px-2 py-0.5 border border-[#444444] text-[#888888] font-mono uppercase">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {task.metadata?.priority && !isRawTask && (
        <span className="text-xs px-2 py-1 border border-[#E6E6E6] bg-transparent text-[#E6E6E6] font-mono uppercase tracking-wider ml-auto">
          {task.metadata.priority}
        </span>
      )}

      {/* Badges for raw tasks - placed inline */}
      {isRawTask && (
        <>
          <span className="text-xs px-2 py-1 border border-[#555555] bg-transparent text-[#888888] font-mono uppercase tracking-wider ml-auto">
            FEATURE
          </span>
          <span className="text-xs px-2 py-1 border border-[#FF4D00] bg-transparent text-[#FF4D00] font-mono uppercase tracking-wider">
            [RAW]
          </span>
        </>
      )}

      {/* Buttons - absolute positioned at bottom right for all tasks */}
      {isHovered && !isEditing && !isEditingMetadata && (
        <div className="absolute right-3 bottom-3 flex gap-1">
          {/* Format button - only for raw tasks */}
          {isRawTask && (
            <button
              onClick={() => onFormat(task.id)}
              disabled={isFormattingTaskId === task.id}
              className={`transition-colors duration-150 p-1 border bg-[#000000] ${
                isFormattingTaskId === task.id
                  ? 'text-[#888888] border-[#888888] cursor-not-allowed'
                  : 'text-[#FF4D00] hover:text-[#E6E6E6] border-[#FF4D00] hover:border-[#E6E6E6]'
              }`}
              title={isFormattingTaskId === task.id ? "Formatting..." : "Format with Claude (CMD+F)"}
            >
              {isFormattingTaskId === task.id ? (
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
                  className="animate-spin"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
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
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={handleMetadataEdit}
            className="text-[#E6E6E6] hover:text-[#FF4D00] transition-colors duration-150 p-1 border border-[#E6E6E6] hover:border-[#FF4D00] bg-[#000000]"
            title="Edit metadata (M)"
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
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
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

    {/* Render subtasks if expanded */}
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
            onFormat={onFormat}
            onFocus={onFocus}
            isFocused={false}
            isExpanded={expandedTasks.has(subtask.id)}
            onToggleExpand={onToggleExpand}
            expandedTasks={expandedTasks}
            isFormattingTaskId={isFormattingTaskId}
            depth={depth + 1}
          />
        ))}
      </>
    )}
    </>
  );
};

type FilterMode = 'all' | 'unchecked' | 'critical' | 'blocked';

export const TaskTree: React.FC<TaskTreeProps> = ({ tasks, onUpdate, projectRoot }) => {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingRelationshipsTaskId, setEditingRelationshipsTaskId] = useState<string | null>(null);
  const [formattingTaskId, setFormattingTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  // Flatten tasks for navigation
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

  // Apply filter to flat tasks
  const applyFilter = (taskList: TaskNode[]): TaskNode[] => {
    switch (filterMode) {
      case 'unchecked':
        return taskList.filter(task => !task.checked);
      case 'critical':
        return taskList.filter(task => task.metadata?.priority === 'critical');
      case 'blocked':
        return taskList.filter(task => task.metadata?.blocked_by && task.metadata.blocked_by.length > 0);
      default:
        return taskList;
    }
  };

  const flatTasks = flattenTasks(tasks);
  const displayTasks = applyFilter(flatTasks);

  // Copy task to clipboard
  const copyTaskToClipboard = async (task: TaskNode) => {
    let copyText = task.text;
    if (task.metadata?.priority) {
      copyText += `\nPriority: ${task.metadata.priority}`;
    }
    if (task.metadata?.notes && task.metadata.notes.length > 0) {
      copyText += `\nNotes:\n${task.metadata.notes.map(note => `  - ${note}`).join('\n')}`;
    }
    if (task.metadata?.deadline) {
      copyText += `\nDeadline: ${task.metadata.deadline}`;
    }
    if (task.metadata?.effort_estimate) {
      copyText += `\nEstimate: ${task.metadata.effort_estimate}`;
    }
    if (task.metadata?.tags && task.metadata.tags.length > 0) {
      copyText += `\nTags: ${task.metadata.tags.join(', ')}`;
    }
    if (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) {
      copyText += `\nBlocked by: ${task.metadata.blocked_by.join(', ')}`;
    }
    if (task.metadata?.depends_on && task.metadata.depends_on.length > 0) {
      copyText += `\nDepends on: ${task.metadata.depends_on.join(', ')}`;
    }
    if (task.metadata?.related_to && task.metadata.related_to.length > 0) {
      copyText += `\nRelated: ${task.metadata.related_to.join(', ')}`;
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

  // Toggle expand/collapse for subtasks
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when container is mounted and not in an input
      if (!containerRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // N key to create new task
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsCreating(true);
        return;
      }

      // R key to edit relationships
      if ((e.key === 'r' || e.key === 'R') && focusedTaskId) {
        e.preventDefault();
        setEditingRelationshipsTaskId(focusedTaskId);
        return;
      }

      // Filter toggles (1-4 keys)
      if (e.key === '1') {
        e.preventDefault();
        setFilterMode('all');
        return;
      } else if (e.key === '2') {
        e.preventDefault();
        setFilterMode('unchecked');
        return;
      } else if (e.key === '3') {
        e.preventDefault();
        setFilterMode('critical');
        return;
      } else if (e.key === '4') {
        e.preventDefault();
        setFilterMode('blocked');
        return;
      }

      // ArrowRight to expand
      if (e.key === 'ArrowRight' && focusedTaskId) {
        e.preventDefault();
        const task = flatTasks.find(t => t.id === focusedTaskId);
        if (task && task.subtasks && task.subtasks.length > 0) {
          if (!expandedTasks.has(focusedTaskId)) {
            handleToggleExpand(focusedTaskId);
          }
        }
        return;
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
        return;
      }
      // Arrow navigation (use displayTasks for filtered navigation)
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!focusedTaskId && displayTasks.length > 0) {
          setFocusedTaskId(displayTasks[0].id);
        } else if (focusedTaskId) {
          const currentIndex = displayTasks.findIndex(t => t.id === focusedTaskId);
          if (currentIndex < displayTasks.length - 1) {
            setFocusedTaskId(displayTasks[currentIndex + 1].id);
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focusedTaskId) {
          const currentIndex = displayTasks.findIndex(t => t.id === focusedTaskId);
          if (currentIndex > 0) {
            setFocusedTaskId(displayTasks[currentIndex - 1].id);
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
      // Cmd+F to format focused task
      else if ((e.metaKey || e.ctrlKey) && e.key === 'f' && focusedTaskId) {
        e.preventDefault();
        const task = flatTasks.find(t => t.id === focusedTaskId);
        // Only format if task is unformatted
        if (task && task.metadata?.formatted === false) {
          handleFormat(focusedTaskId);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedTaskId, displayTasks, flatTasks, tasks, expandedTasks]);

  // Scroll focused task into view
  useEffect(() => {
    if (focusedTaskId) {
      const element = document.querySelector(`[data-task-id="${focusedTaskId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedTaskId]);

  // Focus input when entering create mode
  useEffect(() => {
    if (isCreating && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isCreating]);

  const handleToggle = (id: string) => {
    const toggleRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.map((task) => {
        if (task.id === id) {
          return { ...task, checked: !task.checked };
        }
        if (task.children.length > 0) {
          return { ...task, children: toggleRecursive(task.children) };
        }
        if (task.subtasks && task.subtasks.length > 0) {
          return { ...task, subtasks: toggleRecursive(task.subtasks) };
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
        if (task.subtasks && task.subtasks.length > 0) {
          return { ...task, subtasks: updateRecursive(task.subtasks) };
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
        if (task.subtasks && task.subtasks.length > 0) {
          return { ...task, subtasks: updateRecursive(task.subtasks) };
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
        if (task.subtasks && task.subtasks.length > 0) {
          task.subtasks = deleteRecursive(task.subtasks);
        }
        return true;
      });
    };
    onUpdate(deleteRecursive(tasks));
  };

  const handleMetadataChange = (id: string, metadata: TaskNode['metadata']) => {
    const updateRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.map((task) => {
        if (task.id === id) {
          return { ...task, metadata };
        }
        if (task.children.length > 0) {
          return { ...task, children: updateRecursive(task.children) };
        }
        if (task.subtasks && task.subtasks.length > 0) {
          return { ...task, subtasks: updateRecursive(task.subtasks) };
        }
        return task;
      });
    };
    onUpdate(updateRecursive(tasks));
  };

  const handleSaveRelationships = (taskId: string, dependsOn: string[], relatedTo: string[]) => {
    const updateRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            metadata: {
              ...task.metadata,
              depends_on: dependsOn.length > 0 ? dependsOn : undefined,
              related_to: relatedTo.length > 0 ? relatedTo : undefined,
            },
          };
        }
        if (task.children.length > 0) {
          return { ...task, children: updateRecursive(task.children) };
        }
        if (task.subtasks && task.subtasks.length > 0) {
          return { ...task, subtasks: updateRecursive(task.subtasks) };
        }
        return task;
      });
    };
    onUpdate(updateRecursive(tasks));
  };

  const handleFormat = async (taskId: string) => {
    const task = flatTasks.find(t => t.id === taskId);
    if (!task) return;

    // Set loading state
    setFormattingTaskId(taskId);

    try {
      // Call the IPC handler to format the task
      const result = await window.electronAPI.formatSingleTask(task.text, projectRoot);

      if (!result.success) {
        alert(`Failed to format task: ${result.error}`);
        setFormattingTaskId(null);
        return;
      }

      // Parse the Claude response
      const response = result.data;

      // Extract formatted metadata from the first task in the first section
      if (response.sections.length === 0 || response.sections[0].tasks.length === 0) {
        alert('No formatted data received from Claude');
        setFormattingTaskId(null);
        return;
      }

      const formattedTask = response.sections[0].tasks[0];
      const section = response.sections[0];

      // Update the task with formatted metadata
      const updateRecursive = (taskList: TaskNode[]): TaskNode[] => {
        return taskList.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              text: formattedTask.text, // Update text with formatted version
              metadata: {
                ...t.metadata,
                priority: section.priority as 'critical' | 'performance' | 'feature',
                notes: formattedTask.notes,
                depends_on: formattedTask.depends_on,
                related_to: formattedTask.related_to,
                deadline: formattedTask.deadline,
                effort_estimate: formattedTask.effort_estimate,
                tags: formattedTask.tags,
                formatted: true, // Mark as formatted
              },
            };
          }
          if (t.children.length > 0) {
            return { ...t, children: updateRecursive(t.children) };
          }
          if (t.subtasks && t.subtasks.length > 0) {
            return { ...t, subtasks: updateRecursive(t.subtasks) };
          }
          return t;
        });
      };

      onUpdate(updateRecursive(tasks));
      setFormattingTaskId(null);
    } catch (error) {
      console.error('Format error:', error);
      alert(`Failed to format task: ${error.message}`);
      setFormattingTaskId(null);
    }
  };

  const handleCreateTask = () => {
    if (!newTaskText.trim()) {
      setIsCreating(false);
      setNewTaskText('');
      return;
    }

    const newTask: TaskNode = {
      id: uuidv4(),
      text: newTaskText.trim(),
      checked: false,
      indent: 0,
      children: [],
      metadata: {
        priority: 'feature', // Default priority
        formatted: false, // Not yet analyzed by Claude
      },
    };

    // Add to end of tasks list
    onUpdate([...tasks, newTask]);

    // Reset state
    setNewTaskText('');
    setIsCreating(false);

    // Focus the new task
    setFocusedTaskId(newTask.id);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewTaskText('');
  };

  const handleNewTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateTask();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelCreate();
    }
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
      {/* Filter indicator */}
      {filterMode !== 'all' && (
        <div className="p-2 border-b border-[#FF4D00] bg-[#FF4D00]/10">
          <span className="text-[#FF4D00] text-xs font-mono uppercase tracking-wider">
            [FILTER: {filterMode.toUpperCase()}] ({displayTasks.length}/{flatTasks.length} tasks)
          </span>
        </div>
      )}

      <div className="flex-1 overflow-auto py-1">
        {/* Inline task creation input */}
        {isCreating && (
          <div className="flex items-center gap-3 p-3 border-b border-[#FF4D00] bg-[#FF4D00]/5">
            <div className="w-4 h-4 border border-[#FF4D00] bg-transparent flex-shrink-0 mt-1" />
            <input
              ref={newTaskInputRef}
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={handleNewTaskKeyDown}
              onBlur={handleCreateTask}
              placeholder="Enter task description..."
              className="flex-1 bg-[#0A0A0A] text-[#E6E6E6] px-2 py-1 border border-[#FF4D00] outline-none text-sm font-mono placeholder:text-[#666666]"
            />
            <span className="text-xs px-2 py-1 border border-[#555555] bg-transparent text-[#888888] font-mono uppercase tracking-wider">
              FEATURE
            </span>
          </div>
        )}

        {displayTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={handleToggle}
            onTextChange={handleTextChange}
            onIndentChange={handleIndentChange}
            onDelete={handleDelete}
            onMetadataChange={handleMetadataChange}
            onFormat={handleFormat}
            onFocus={setFocusedTaskId}
            isFocused={task.id === focusedTaskId}
            isExpanded={expandedTasks.has(task.id)}
            onToggleExpand={handleToggleExpand}
            expandedTasks={expandedTasks}
            isFormattingTaskId={formattingTaskId}
          />
        ))}
      </div>

      {/* Keyboard shortcut hints */}
      <div className="flex items-center gap-4 p-3 border-t border-[#222222] overflow-x-auto flex-nowrap bg-[#0A0A0A]">
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">N</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">NEW</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">SHIFT</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">V</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">VOICE</span>
        </div>
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
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">M</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">METADATA</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">1</kbd>
          <span className="text-[#666666]">/</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">2</kbd>
          <span className="text-[#666666]">/</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">3</kbd>
          <span className="text-[#666666]">/</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">4</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">FILTER</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">←</kbd>
          <span className="text-[#666666]">/</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">→</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">EXPAND</span>
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
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">R</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">RELATIONSHIPS</span>
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

      {/* Relationship Editor Modal */}
      {editingRelationshipsTaskId && (() => {
        const task = flatTasks.find(t => t.id === editingRelationshipsTaskId);
        if (!task) return null;
        return (
          <RelationshipEditor
            task={task}
            allTasks={flatTasks}
            onSave={handleSaveRelationships}
            onClose={() => setEditingRelationshipsTaskId(null)}
          />
        );
      })()}
    </div>
  );
};

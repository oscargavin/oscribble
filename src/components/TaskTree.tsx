import React, { useState, useEffect, useRef } from 'react';
import { TaskNode } from '../types';
import { Checkbox } from './ui/checkbox';
import { v4 as uuidv4 } from 'uuid';
import { FileAutocomplete } from './FileAutocomplete';

type FilterMode = 'all' | 'unchecked' | 'complete' | 'high' | 'blocked';

interface TaskTreeProps {
  tasks: TaskNode[];
  onUpdate: (tasks: TaskNode[]) => void;
  projectRoot: string;
  projectName: string;
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  showContextFiles: Set<string>;
  setShowContextFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  hasVoice?: boolean;
}

interface EmptyStateProps {
  filterMode: FilterMode;
  hasVoice?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ filterMode, hasVoice = false }) => {
  const getEmptyMessage = (): string => {
    switch (filterMode) {
      case 'unchecked':
        return '[NO UNCOMPLETED TASKS]';
      case 'complete':
        return '[NO COMPLETED TASKS]';
      case 'high':
        return '[NO HIGH PRIORITY TASKS]';
      case 'blocked':
        return '[NO BLOCKED TASKS]';
      case 'all':
      default:
        return '[NO TASKS IN VIEW]';
    }
  };

  const getHelpText = () => {
    if (filterMode === 'unchecked') {
      return (
        <>
          <div className="text-[#666666]">Press <span className="text-[#888888]">N</span> for new task</div>
          <div className="text-[#666666]">Press <span className="text-[#888888]">CMD+T</span> for raw text to format many tasks</div>
          {hasVoice && (
            <div className="text-[#666666]">Press <span className="text-[#888888]">CMD+R</span> for voice input</div>
          )}
        </>
      );
    }
    return (
      <div className="text-[#444444]">
        Press <span className="text-[#666666]">1-5</span> to change filter
      </div>
    );
  };

  return (
    <div className="w-full px-6 py-8">
      <div className="relative border-l-4 border-l-[#333333] border border-[#222222] bg-[#0A0A0A] px-8 py-6">
        <div className="text-[#666666] text-sm font-mono uppercase tracking-wider text-center font-bold">
          {getEmptyMessage()}
        </div>
        <div className="text-xs font-mono tracking-wider text-center mt-3 space-y-1">
          {getHelpText()}
        </div>
      </div>
    </div>
  );
};

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
  isSelected: boolean;
  isFirstSelected?: boolean;
  isLastSelected?: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  expandedTasks: Set<string>;
  isFormattingTaskId: string | null;
  depth?: number;
  showContextFiles: Set<string>;
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
  isSelected,
  isFirstSelected = false,
  isLastSelected = false,
  isExpanded,
  onToggleExpand,
  expandedTasks,
  isFormattingTaskId,
  depth = 0,
  showContextFiles,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
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

  // Listen for keyboard shortcuts
  useEffect(() => {
    if (isFocused && !isEditing && !isEditingMetadata && !isEditingPriority) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'm' || e.key === 'M') && e.target === document.body) {
          e.preventDefault();
          handleMetadataEdit();
        }
        if ((e.key === 'p' || e.key === 'P') && e.target === document.body && task.metadata?.priority) {
          e.preventDefault();
          setIsEditingPriority(true);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }

    // ESC to close priority editor
    if (isEditingPriority) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsEditingPriority(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFocused, isEditing, isEditingMetadata, isEditingPriority, task.metadata?.priority]);

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
      case 'high':
        return 'border-l-2 border-l-[#FF4D00]';
      case 'medium':
        return 'border-l-2 border-l-[#E6E6E6]';
      case 'low':
        return ''; // No border for low priority (default)
      default:
        return '';
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'border-[#FF4D00] text-[#FF4D00]';
      case 'medium':
        return 'border-[#E6E6E6] text-[#E6E6E6]';
      case 'low':
        return 'border-[#666666] text-[#666666]';
    }
  };

  const handlePriorityChange = (newPriority: 'high' | 'medium' | 'low') => {
    const updatedMetadata = {
      ...task.metadata,
      priority: newPriority,
      original_priority: task.metadata?.original_priority || task.metadata?.priority, // Store original if first edit
      priority_edited: true,
    };

    onMetadataChange(task.id, updatedMetadata);
    setIsEditingPriority(false);
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  const isRawTask = task.metadata?.formatted === false;

  // Build selection border classes for continuous rectangle effect
  const getSelectionBorderClasses = () => {
    if (!isSelected) return '';

    const classes = ['bg-[#FF4D00]/10'];

    // Single selected task gets full border
    if (isFirstSelected && isLastSelected) {
      classes.push('border-2 border-[#FF4D00]');
    } else {
      // Left and right borders always present when selected
      classes.push('border-l-2 border-l-[#FF4D00]', 'border-r-2 border-r-[#FF4D00]');

      // Top border only on first selected, otherwise transparent
      if (isFirstSelected) {
        classes.push('border-t-2 border-t-[#FF4D00]');
      } else {
        classes.push('border-t-2 border-t-transparent');
      }

      // Bottom border only on last selected, otherwise transparent
      if (isLastSelected) {
        classes.push('border-b-2 border-b-[#FF4D00]');
      } else {
        classes.push('border-b-2 border-b-transparent');
      }
    }

    return classes.join(' ');
  };

  return (
    <>
    <div
      data-task-id={task.id}
      className={`flex items-start gap-3 p-3 border-2 ${!isSelected && !isFocused ? 'border-transparent border-b-[#111111]' : ''} hover:bg-[#0A0A0A] transition-colors duration-150 relative group cursor-pointer ${getPriorityStyles()} ${isFocused ? 'border-[#FF4D00] bg-[#FF4D00]/5' : ''} ${getSelectionBorderClasses()}`}
      style={{
        marginLeft: `${(task.indent + depth) * 20}px`,
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
      <div className="relative flex-shrink-0">
        <Checkbox
          checked={task.checked}
          onCheckedChange={() => onToggle(task.id)}
          className="mt-1 cursor-pointer"
        />
      </div>

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
            <div className="text-xs text-[#888888] mt-1 font-mono pl-4 relative">
              {/* Vertical trunk line for all notes except after the last one */}
              <div className="absolute left-[1.2rem] top-0 bottom-0 w-[1px] bg-[#333333]" style={{ height: 'calc(100% - 1em)' }} />

              {task.metadata.notes.map((note, index) => {
                const isLast = index === task.metadata!.notes!.length - 1;
                const branch = isLast ? '└─' : '├─';
                return (
                  <div key={index} className="flex items-start relative" style={{ lineHeight: '1.2' }}>
                    <span className="text-[#333333] mr-1 flex-shrink-0 z-10 bg-[var(--bg-primary)]">{branch}</span>
                    <span className="flex-1">{note}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Context used */}
          {task.metadata?.notes && task.metadata.notes.some(note => note.startsWith('Context:')) && (
            <div className="mt-1 text-xs text-[#666666] pl-4 font-mono border-l border-[#444444]">
              <div className="font-bold text-[#888888] uppercase tracking-wider mb-1">[CONTEXT]</div>
              {task.metadata.notes
                .filter(note => note.startsWith('Context:'))
                .map((note, i) => (
                  <div key={i} className="ml-2 text-[#666666]">
                    • {note.replace('Context: ', '')}
                  </div>
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
          {showContextFiles.has(task.id) && task.metadata?.context_files && task.metadata.context_files.length > 0 && (
            <div className="mt-1 text-xs text-[#666666] pl-4 font-mono border-l border-[#444444]">
              <div className="font-bold text-[#888888] uppercase tracking-wider mb-1">[CONTEXT FILES]</div>
              {task.metadata.context_files.map((file, i) => (
                <div key={i} className="ml-2 text-[#666666]">
                  • {file.path}
                  {file.wasGrepped && file.matchedKeywords && (
                    <span className="text-[#555555]"> (grep: {file.matchedKeywords.join(', ')})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {task.metadata?.priority && !isRawTask && !isEditingPriority && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingPriority(true);
          }}
          className={`text-xs px-2 py-1 border bg-transparent font-mono uppercase tracking-wider ml-auto hover:opacity-80 transition-opacity ${getPriorityColor(task.metadata.priority)}`}
          title={`Click to change priority${task.metadata.priority_edited ? ' (edited by you)' : ''}`}
        >
          {task.metadata.priority}
          {task.metadata.priority_edited && (
            <span className="ml-1 text-[10px]">*</span>
          )}
        </button>
      )}

      {/* Priority Editor Dropdown */}
      {isEditingPriority && (
        <div className="absolute right-3 top-12 z-50 bg-black border-2 border-[#FF4D00] shadow-lg">
          <div className="p-2 border-b border-[#333333]">
            <div className="text-[#E6E6E6] font-mono text-xs uppercase tracking-wider mb-1">
              [PRIORITY]
            </div>
            {task.metadata?.original_priority && task.metadata.original_priority !== task.metadata.priority && (
              <div className="text-[#666666] font-mono text-[10px]">
                Claude suggested: {task.metadata.original_priority}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <button
              onClick={() => handlePriorityChange('high')}
              className={`px-3 py-2 text-left text-xs font-mono uppercase border-b border-[#333333] ${
                task.metadata?.priority === 'high'
                  ? 'bg-[#FF4D00]/20 text-[#FF4D00] border-[#FF4D00]'
                  : 'text-[#E6E6E6] hover:bg-[#FF4D00]/10 hover:text-[#FF4D00]'
              }`}
            >
              HIGH
            </button>
            <button
              onClick={() => handlePriorityChange('medium')}
              className={`px-3 py-2 text-left text-xs font-mono uppercase border-b border-[#333333] ${
                task.metadata?.priority === 'medium'
                  ? 'bg-[#E6E6E6]/20 text-[#E6E6E6] border-[#E6E6E6]'
                  : 'text-[#888888] hover:bg-[#E6E6E6]/10 hover:text-[#E6E6E6]'
              }`}
            >
              MEDIUM
            </button>
            <button
              onClick={() => handlePriorityChange('low')}
              className={`px-3 py-2 text-left text-xs font-mono uppercase ${
                task.metadata?.priority === 'low'
                  ? 'bg-[#666666]/20 text-[#666666] border-[#666666]'
                  : 'text-[#666666] hover:bg-[#666666]/10 hover:text-[#888888]'
              }`}
            >
              LOW
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingPriority(false);
            }}
            className="w-full px-3 py-2 border-t border-[#333333] text-[#666666] hover:text-[#E6E6E6] text-xs font-mono uppercase transition-colors"
          >
            [ESC] CANCEL
          </button>
        </div>
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

      {/* Active task indicator - clean pulse at bottom, aligned with checkbox */}
      {task.metadata?.start_time && !task.metadata?.duration && (
        <span className="absolute left-5 bottom-1 flex h-1.5 w-1.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4D00] opacity-40 [animation-duration:2s]"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FF4D00]"></span>
        </span>
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
            isSelected={false}
            isFirstSelected={false}
            isLastSelected={false}
            isExpanded={expandedTasks.has(subtask.id)}
            onToggleExpand={onToggleExpand}
            expandedTasks={expandedTasks}
            isFormattingTaskId={isFormattingTaskId}
            depth={depth + 1}
            showContextFiles={showContextFiles}
          />
        ))}
      </>
    )}
    </>
  );
};

export const TaskTree: React.FC<TaskTreeProps> = ({ tasks, onUpdate, projectRoot, projectName, filterMode, setFilterMode, showContextFiles, setShowContextFiles, hasVoice = false }) => {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingRelationshipsTaskId, setEditingRelationshipsTaskId] = useState<string | null>(null);
  const [formattingTaskId, setFormattingTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevTaskCountRef = useRef(tasks.length);
  const navigationScheduledRef = useRef<number | null>(null);
  const taskContainerRef = useRef<HTMLDivElement>(null);

  // File autocomplete state
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  // Load project files for autocomplete
  useEffect(() => {
    if (projectRoot) {
      window.electronAPI.getProjectFiles(projectRoot).then((result) => {
        if (result.success && result.files) {
          setProjectFiles(result.files);
        }
      });
    }
  }, [projectRoot]);

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
      case 'complete':
        return taskList.filter(task => task.checked);
      case 'high':
        return taskList.filter(task => task.metadata?.priority === 'high');
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

  // Clear all tasks visible in current view (respects filter mode)
  const clearAllTasks = () => {
    // Get IDs of all tasks visible in current view
    const visibleTaskIds = new Set(displayTasks.map(task => task.id));

    // Filter out only the tasks that are visible in current view
    const deleteRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.filter((task) => {
        // If this task is visible in current view, remove it
        if (visibleTaskIds.has(task.id)) {
          return false;
        }
        // Otherwise keep it, but recursively check children/subtasks
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
    setFocusedTaskId(null);
    setSelectedTaskIds(new Set());
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

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only handle if we have a focused task or selected tasks
      if (!focusedTaskId && selectedTaskIds.size === 0) return;

      const target = e.target as HTMLElement;

      // Check if click is outside the task container
      if (taskContainerRef.current && !taskContainerRef.current.contains(target)) {
        // Clear both focus and selection
        setFocusedTaskId(null);
        setSelectedTaskIds(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [focusedTaskId, selectedTaskIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when container is mounted and not in an input
      if (!containerRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Number keys to switch filter mode
      if (e.key === '1') {
        e.preventDefault();
        setFilterMode('unchecked');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        setFilterMode('complete');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        setFilterMode('all');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        setFilterMode('high');
        return;
      }
      if (e.key === '5') {
        e.preventDefault();
        setFilterMode('blocked');
        return;
      }

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

        // Cancel any pending navigation
        if (navigationScheduledRef.current !== null) {
          cancelAnimationFrame(navigationScheduledRef.current);
        }

        // Schedule navigation for next frame to throttle rapid keypresses
        navigationScheduledRef.current = requestAnimationFrame(() => {
          if (!focusedTaskId && displayTasks.length > 0) {
            setFocusedTaskId(displayTasks[0].id);
            if (!e.shiftKey) {
              setSelectedTaskIds(new Set());
            }
          } else if (focusedTaskId) {
            const currentIndex = displayTasks.findIndex(t => t.id === focusedTaskId);
            const nextIndex = currentIndex < displayTasks.length - 1 ? currentIndex + 1 : 0;
            const nextTaskId = displayTasks[nextIndex].id;

            if (e.shiftKey) {
              // Extend selection
              setSelectedTaskIds(prev => {
                const newSet = new Set(prev);
                // Always include the focused task in selection
                newSet.add(focusedTaskId);
                newSet.add(nextTaskId);
                return newSet;
              });
            } else {
              // Clear selection when moving without shift
              setSelectedTaskIds(new Set());
            }

            setFocusedTaskId(nextTaskId);
          }
          navigationScheduledRef.current = null;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();

        // Cancel any pending navigation
        if (navigationScheduledRef.current !== null) {
          cancelAnimationFrame(navigationScheduledRef.current);
        }

        // Schedule navigation for next frame to throttle rapid keypresses
        navigationScheduledRef.current = requestAnimationFrame(() => {
          if (focusedTaskId) {
            const currentIndex = displayTasks.findIndex(t => t.id === focusedTaskId);
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : displayTasks.length - 1;
            const prevTaskId = displayTasks[prevIndex].id;

            if (e.shiftKey) {
              // Extend selection
              setSelectedTaskIds(prev => {
                const newSet = new Set(prev);
                // Always include the focused task in selection
                newSet.add(focusedTaskId);
                newSet.add(prevTaskId);
                return newSet;
              });
            } else {
              // Clear selection when moving without shift
              setSelectedTaskIds(new Set());
            }

            setFocusedTaskId(prevTaskId);
          }
          navigationScheduledRef.current = null;
        });
      }
      // Space to toggle
      else if (e.key === ' ' && focusedTaskId) {
        e.preventDefault();
        // Toggle selected tasks if any are selected, otherwise toggle focused task
        if (selectedTaskIds.size > 0) {
          handleBatchToggle();
        } else {
          handleToggle(focusedTaskId);
        }
      }
      // Delete key
      else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedTaskId) {
        e.preventDefault();
        // Delete selected tasks if any are selected, otherwise delete focused task
        if (selectedTaskIds.size > 0) {
          handleBatchDelete();
        } else {
          handleDelete(focusedTaskId);
        }
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
      // Cmd+O to toggle context files visibility for focused/selected tasks
      else if ((e.metaKey || e.ctrlKey) && e.key === 'o' && focusedTaskId) {
        e.preventDefault();
        setShowContextFiles(prev => {
          const newSet = new Set(prev);

          // If there are selected tasks, toggle all of them
          if (selectedTaskIds.size > 0) {
            // Check if all selected tasks are currently visible
            const allVisible = Array.from(selectedTaskIds).every(id => newSet.has(id));

            if (allVisible) {
              // Hide all selected tasks
              selectedTaskIds.forEach(id => newSet.delete(id));
            } else {
              // Show all selected tasks
              selectedTaskIds.forEach(id => newSet.add(id));
            }
          } else {
            // No selection, toggle just the focused task
            if (newSet.has(focusedTaskId)) {
              newSet.delete(focusedTaskId);
            } else {
              newSet.add(focusedTaskId);
            }
          }

          return newSet;
        });
      }
      // C key to clear selection/deselect
      else if ((e.key === 'c' || e.key === 'C') && (focusedTaskId || selectedTaskIds.size > 0)) {
        // Only trigger if not using Cmd/Ctrl (to avoid conflict with copy)
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setFocusedTaskId(null);
          setSelectedTaskIds(new Set());
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

  // Scroll to bottom when new tasks are added
  useEffect(() => {
    const currentTaskCount = tasks.length;
    const prevTaskCount = prevTaskCountRef.current;

    // Only scroll if tasks were added (not removed or just updated)
    if (currentTaskCount > prevTaskCount && scrollContainerRef.current) {
      // Use setTimeout to ensure DOM has updated with new tasks
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 50);
    }

    // Update the previous count
    prevTaskCountRef.current = currentTaskCount;
  }, [tasks]);

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

  const handleBatchDelete = () => {
    if (selectedTaskIds.size === 0) return;

    const deleteRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.filter((task) => {
        if (selectedTaskIds.has(task.id)) {
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
    setSelectedTaskIds(new Set());
    setFocusedTaskId(null);
  };

  const handleBatchToggle = () => {
    if (selectedTaskIds.size === 0) return;

    const toggleRecursive = (taskList: TaskNode[]): TaskNode[] => {
      return taskList.map((task) => {
        if (selectedTaskIds.has(task.id)) {
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
    setSelectedTaskIds(new Set());
  };

  const handleMetadataChange = async (id: string, metadata: TaskNode['metadata']) => {
    // Check if priority was edited
    const findTask = (taskList: TaskNode[]): TaskNode | null => {
      for (const task of taskList) {
        if (task.id === id) return task;
        if (task.children.length > 0) {
          const found = findTask(task.children);
          if (found) return found;
        }
        if (task.subtasks && task.subtasks.length > 0) {
          const found = findTask(task.subtasks);
          if (found) return found;
        }
      }
      return null;
    };

    const task = findTask(tasks);
    if (task && metadata?.priority_edited && metadata.priority !== task.metadata?.priority) {
      // Priority was changed - log it for learning
      const originalPriority = metadata.original_priority || task.metadata?.priority;
      if (originalPriority && metadata.priority && originalPriority !== metadata.priority) {
        try {
          await window.electronAPI.logPriorityEdit({
            task_id: id,
            task_text: task.text,
            original_priority: originalPriority as 'high' | 'medium' | 'low',
            edited_priority: metadata.priority as 'high' | 'medium' | 'low',
            edited_at: Date.now(),
            task_context: {
              tags: metadata.tags,
              deadline: metadata.deadline,
              effort_estimate: metadata.effort_estimate,
              has_dependencies: !!(metadata.depends_on && metadata.depends_on.length > 0),
            },
          }, projectName);
        } catch (error) {
          console.error('Failed to log priority edit:', error);
        }
      }
    }

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
      const contextFiles = result.contextFiles || [];

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
            const priority = section.priority as 'high' | 'medium' | 'low';
            return {
              ...t,
              text: formattedTask.text, // Update text with formatted version
              metadata: {
                ...t.metadata,
                priority: priority,
                original_priority: priority, // Store Claude's original suggestion
                priority_edited: false, // Not yet edited by user
                notes: formattedTask.notes,
                depends_on: formattedTask.depends_on,
                related_to: formattedTask.related_to,
                deadline: formattedTask.deadline,
                effort_estimate: formattedTask.effort_estimate,
                tags: formattedTask.tags,
                formatted: true, // Mark as formatted
                context_files: contextFiles, // Store context files metadata
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

  const handleCreateTask = async () => {
    if (!newTaskText.trim()) {
      setIsCreating(false);
      setNewTaskText('');
      setShowAutocomplete(false);
      return;
    }

    // Gather context from @mentions if present
    let contextFiles: Array<{ path: string; wasGrepped: boolean; matchedKeywords?: string[] }> = [];
    if (newTaskText.includes('@')) {
      try {
        const contextResult = await window.electronAPI.gatherProjectContext(newTaskText, projectRoot);
        if (contextResult.success && contextResult.data.files) {
          contextFiles = contextResult.data.files.map((f: any) => ({
            path: f.path,
            wasGrepped: f.wasGrepped,
            matchedKeywords: f.matchedKeywords
          }));
        }
      } catch (error) {
        console.error('Failed to gather context:', error);
      }
    }

    const newTask: TaskNode = {
      id: uuidv4(),
      text: newTaskText.trim(),
      checked: false,
      indent: 0,
      children: [],
      metadata: {
        formatted: false, // Not yet analyzed by Claude
        context_files: contextFiles.length > 0 ? contextFiles : undefined,
      },
    };

    // Add to end of tasks list
    onUpdate([...tasks, newTask]);

    // Reset state
    setNewTaskText('');
    setIsCreating(false);
    setShowAutocomplete(false);

    // Focus the new task
    setFocusedTaskId(newTask.id);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewTaskText('');
    setShowAutocomplete(false);
  };

  const handleNewTaskTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;

    setNewTaskText(value);
    setCursorPosition(cursor);

    // Check if we should show autocomplete
    // Look backwards from cursor to find @ symbol
    let atIndex = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (value[i] === '@') {
        atIndex = i;
        break;
      }
      if (value[i] === ' ' || value[i] === '\n') {
        break; // Stop if we hit whitespace before finding @
      }
    }

    if (atIndex !== -1) {
      // Extract query from @ to cursor
      const query = value.substring(atIndex + 1, cursor);
      setAutocompleteQuery(query);
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleFileSelect = (file: string) => {
    // Find the @ symbol before cursor
    let atIndex = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (newTaskText[i] === '@') {
        atIndex = i;
        break;
      }
      if (newTaskText[i] === ' ' || newTaskText[i] === '\n') {
        break;
      }
    }

    if (atIndex !== -1) {
      // Replace from @ to cursor with @file
      const before = newTaskText.substring(0, atIndex);
      const after = newTaskText.substring(cursorPosition);
      const newText = `${before}@${file}${after}`;

      setNewTaskText(newText);
      setShowAutocomplete(false);

      // Focus back on input
      if (newTaskInputRef.current) {
        newTaskInputRef.current.focus();
        // Set cursor after the inserted file path
        const newCursorPos = atIndex + file.length + 1;
        setTimeout(() => {
          if (newTaskInputRef.current) {
            newTaskInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      }
    }
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
      <div ref={scrollContainerRef} className="flex-1 overflow-auto py-1">
        <div ref={taskContainerRef}>
        {/* Inline task creation input */}
        {isCreating && (
          <div className="flex items-center gap-3 p-3 border-b border-[#FF4D00] bg-[#FF4D00]/5">
            <input
              ref={newTaskInputRef}
              type="text"
              value={newTaskText}
              onChange={handleNewTaskTextChange}
              onKeyDown={handleNewTaskKeyDown}
              onBlur={handleCreateTask}
              placeholder="Enter task description... (type @ to mention files)"
              className="flex-1 bg-[#0A0A0A] text-[#E6E6E6] px-2 py-1 border border-[#FF4D00] outline-none text-sm font-mono placeholder:text-[#666666]"
            />
          </div>
        )}

        {displayTasks.length === 0 ? (
          <EmptyState filterMode={filterMode} hasVoice={hasVoice} />
        ) : (
          displayTasks.map((task, index) => {
            // Determine if this is the first or last selected task in display order
            const selectedIndices = displayTasks
              .map((t, i) => (selectedTaskIds.has(t.id) ? i : -1))
              .filter(i => i !== -1);
            const firstSelectedIndex = selectedIndices[0];
            const lastSelectedIndex = selectedIndices[selectedIndices.length - 1];

            return (
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
                isSelected={selectedTaskIds.has(task.id)}
                isFirstSelected={index === firstSelectedIndex}
                isLastSelected={index === lastSelectedIndex}
                isExpanded={expandedTasks.has(task.id)}
                onToggleExpand={handleToggleExpand}
                expandedTasks={expandedTasks}
                isFormattingTaskId={formattingTaskId}
                showContextFiles={showContextFiles}
              />
            );
          })
        )}
        </div>
      </div>

      {/* Keyboard shortcut hints */}
      <div className="flex items-center gap-4 p-3 border-t border-[#222222] overflow-x-auto flex-nowrap bg-[#0A0A0A]">
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">1-5</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">FILTER</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">N</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">NEW</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">T</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">TOGGLE VIEW</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">O</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">CONTEXT FILES</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">R</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">RECORD</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">ESC</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">CANCEL REC</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">↑</kbd>
          <span className="text-[#666666]">/</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">↓</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">NAV</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">SHIFT</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">↑</kbd>
          <span className="text-[#666666]">/</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">↓</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">SELECT</span>
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
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">C</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">DESELECT</span>
        </div>
        <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
          <span className="text-[#666666]">+</span>
          <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">1-9</kbd>
          <span className="text-[#888888] text-xs font-mono uppercase">PROJECT (A-Z)</span>
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

      {/* File Autocomplete */}
      {showAutocomplete && isCreating && (
        <FileAutocomplete
          files={projectFiles}
          query={autocompleteQuery}
          onSelect={handleFileSelect}
          onClose={() => setShowAutocomplete(false)}
        />
      )}
    </div>
  );
};

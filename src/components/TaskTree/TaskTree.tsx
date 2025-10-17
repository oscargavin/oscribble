import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";
import { TaskNode } from "../../types";
import { FileAutocomplete } from "../FileAutocomplete";

// Components
import { EmptyState } from "./components/EmptyState";
import { RelationshipEditor } from "./components/RelationshipEditor";
import { TaskRow } from "./components/TaskRow";

// Hooks
import { useTaskFiltering } from "./hooks/useTaskFiltering";
import { useTaskNavigation } from "./hooks/useTaskNavigation";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Utils
import { TaskTreeProps } from "./utils/types";
import {
  toggleTask,
  deleteTask,
  updateTaskText,
  updateTaskMetadata,
  updateTaskIndent,
  copyTaskToClipboard,
  copyAllTasks,
  clearVisibleTasks,
  batchToggleTasks,
  batchDeleteTasks,
} from "./utils/taskOperations";

// Animation variants for staggered fade-in effect
const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.0, 0.0, 0.2, 1.0] as const,
    },
  },
};

export const TaskTree: React.FC<TaskTreeProps> = ({
  tasks,
  onUpdate,
  projectRoot,
  projectName,
  filterMode,
  setFilterMode,
  showContextFiles,
  setShowContextFiles,
  hasVoice = false,
  shouldShowFileTree = true,
  reduceMotion = false,
}) => {
  // State
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingRelationshipsTaskId, setEditingRelationshipsTaskId] =
    useState<string | null>(null);
  const [formattingTaskId, setFormattingTaskId] = useState<string | null>(null);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const taskContainerRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const { flatTasks, displayTasks } = useTaskFiltering(
    tasks,
    filterMode,
    expandedTasks
  );

  const {
    focusedTaskId,
    setFocusedTaskId,
    selectedTaskIds,
    setSelectedTaskIds,
    focusedSubtaskMap,
    setFocusedSubtaskMap,
  } = useTaskNavigation(tasks, projectName, taskContainerRef, scrollContainerRef);

  // Auto-expand tasks with subtasks (only for code projects)
  useEffect(() => {
    if (!shouldShowFileTree) return;

    const newTasksWithSubtasks: string[] = [];

    const findTasksWithSubtasks = (taskList: TaskNode[]) => {
      for (const task of taskList) {
        if (
          task.subtasks &&
          task.subtasks.length > 0 &&
          !expandedTasks.has(task.id)
        ) {
          newTasksWithSubtasks.push(task.id);
          findTasksWithSubtasks(task.subtasks);
        }
        if (task.children.length > 0) {
          findTasksWithSubtasks(task.children);
        }
      }
    };

    findTasksWithSubtasks(tasks);

    if (newTasksWithSubtasks.length > 0) {
      setExpandedTasks((prev) => {
        const newSet = new Set(prev);
        newTasksWithSubtasks.forEach((id) => newSet.add(id));
        return newSet;
      });
    }
  }, [tasks, shouldShowFileTree]);

  // Load project files for autocomplete
  useEffect(() => {
    if (projectRoot && shouldShowFileTree) {
      window.electronAPI.getProjectFiles(projectRoot).then((result) => {
        if (result.success && result.files) {
          setProjectFiles(result.files);
        }
      });
    }
  }, [projectRoot, shouldShowFileTree]);

  // Focus input when entering create mode
  useEffect(() => {
    if (isCreating && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [isCreating]);

  // Delay showing empty state to prevent flicker
  useEffect(() => {
    if (displayTasks.length > 0) {
      setShowEmptyState(false);
    } else {
      const timer = setTimeout(() => {
        setShowEmptyState(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [displayTasks.length]);

  // Task operations
  const handleToggle = (id: string) => {
    onUpdate(toggleTask(tasks, id));
  };

  const handleDelete = (id: string) => {
    onUpdate(deleteTask(tasks, id));
  };

  const handleTextChange = (id: string, text: string) => {
    onUpdate(updateTaskText(tasks, id, text));
  };

  const handleMetadataChange = (
    id: string,
    metadata: TaskNode["metadata"]
  ) => {
    onUpdate(updateTaskMetadata(tasks, id, metadata));
  };

  const handleIndentChange = (id: string, delta: number) => {
    onUpdate(updateTaskIndent(tasks, id, delta));
  };

  const handleBatchToggle = () => {
    onUpdate(batchToggleTasks(tasks, selectedTaskIds));
  };

  const handleBatchDelete = () => {
    onUpdate(batchDeleteTasks(tasks, selectedTaskIds));
    setFocusedTaskId(null);
    setSelectedTaskIds(new Set());
  };

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

  const handleClearAll = () => {
    const visibleTaskIds = new Set(displayTasks.map((task) => task.id));
    onUpdate(clearVisibleTasks(tasks, visibleTaskIds));
    setFocusedTaskId(null);
    setSelectedTaskIds(new Set());
  };

  const handleCopyAllTasks = async () => {
    await copyAllTasks(flatTasks);
  };

  const handleFormat = (id: string, useAutocontext: boolean = true) => {
    setFormattingTaskId(id);
    const task = flatTasks.find((t) => t.id === id);
    if (!task) return;

    window.electronAPI
      .formatSingleTask(task.text, projectRoot, useAutocontext)
      .then((result: { success: boolean; data?: any; contextFiles?: any[] }) => {
        if (result.success && result.data) {
          // Replace the raw task with formatted task
          const updatedTasks = deleteTask(tasks, id);
          const newFormattedTask: TaskNode = {
            ...result.data,
            id: uuidv4(),
            indent: task.indent,
          };
          onUpdate([...updatedTasks, newFormattedTask]);
        }
      })
      .finally(() => {
        setFormattingTaskId(null);
      });
  };

  const handleRelationshipsSave = (
    taskId: string,
    dependsOn: string[],
    relatedTo: string[]
  ) => {
    const task = flatTasks.find((t) => t.id === taskId);
    if (task) {
      const updatedMetadata = {
        ...task.metadata,
        depends_on: dependsOn.length > 0 ? dependsOn : undefined,
        related_to: relatedTo.length > 0 ? relatedTo : undefined,
      };
      handleMetadataChange(taskId, updatedMetadata);
    }
  };

  const handleNewTask = () => {
    if (newTaskText.trim()) {
      const newTask: TaskNode = {
        id: uuidv4(),
        text: newTaskText.trim(),
        checked: false,
        indent: 0,
        children: [],
        metadata: {
          formatted: false,
        },
      };
      onUpdate([...tasks, newTask]);
      setNewTaskText("");
      setIsCreating(false);
    }
  };

  const handleNewTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleNewTask();
    } else if (e.key === "Escape") {
      setNewTaskText("");
      setIsCreating(false);
    } else if (e.key === "@" && shouldShowFileTree) {
      setShowAutocomplete(true);
      setAutocompleteQuery("");
      setCursorPosition(e.currentTarget.selectionStart || 0);
    }
  };

  const handleNewTaskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewTaskText(text);

    if (showAutocomplete && shouldShowFileTree) {
      const cursorPos = e.target.selectionStart || 0;
      const textBeforeCursor = text.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        setAutocompleteQuery(query);
        setCursorPosition(lastAtIndex);
      } else {
        setShowAutocomplete(false);
      }
    }
  };

  const handleFileSelect = (file: string) => {
    const before = newTaskText.slice(0, cursorPosition);
    const after = newTaskText.slice(cursorPosition + autocompleteQuery.length + 1);
    setNewTaskText(`${before}@${file}${after}`);
    setShowAutocomplete(false);
  };

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    containerRef,
    focusedTaskId,
    setFocusedTaskId,
    selectedTaskIds,
    setSelectedTaskIds,
    focusedSubtaskMap,
    setFocusedSubtaskMap,
    displayTasks,
    flatTasks,
    tasks,
    expandedTasks,
    filterMode,
    setFilterMode,
    setIsCreating,
    setEditingRelationshipsTaskId,
    handleToggleExpand,
    handleToggle,
    handleDelete,
    handleFormat,
    handleBatchToggle,
    handleBatchDelete,
    copyTaskToClipboard,
    copyAllTasks: handleCopyAllTasks,
    clearAllTasks: handleClearAll,
    setShowContextFiles,
    shouldShowFileTree,
  });

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {showEmptyState && displayTasks.length === 0 ? (
          <EmptyState filterMode={filterMode} hasVoice={hasVoice} />
        ) : (
          <motion.div
            ref={taskContainerRef}
            variants={reduceMotion ? undefined : containerVariants}
            initial={reduceMotion ? false : "hidden"}
            animate={reduceMotion ? false : "visible"}
          >
            <AnimatePresence>
              {displayTasks.map((task, index) => {
                const isFirstSelected =
                  selectedTaskIds.has(task.id) &&
                  (index === 0 || !selectedTaskIds.has(displayTasks[index - 1].id));
                const isLastSelected =
                  selectedTaskIds.has(task.id) &&
                  (index === displayTasks.length - 1 ||
                    !selectedTaskIds.has(displayTasks[index + 1].id));

                return (
                  <motion.div key={task.id} variants={reduceMotion ? undefined : itemVariants}>
                    <TaskRow
                      task={task}
                      onToggle={handleToggle}
                      onTextChange={handleTextChange}
                      onIndentChange={handleIndentChange}
                      onDelete={handleDelete}
                      onMetadataChange={handleMetadataChange}
                      onFormat={handleFormat}
                      onFocus={setFocusedTaskId}
                      isFocused={focusedTaskId === task.id}
                      isSelected={selectedTaskIds.has(task.id)}
                      isFirstSelected={isFirstSelected}
                      isLastSelected={isLastSelected}
                      isExpanded={expandedTasks.has(task.id)}
                      onToggleExpand={handleToggleExpand}
                      expandedTasks={expandedTasks}
                      isFormattingTaskId={formattingTaskId}
                      showContextFiles={showContextFiles}
                      focusedSubtaskId={
                        focusedTaskId === task.id
                          ? focusedSubtaskMap.get(task.id) || null
                          : null
                      }
                      onSubtaskFocus={(subtaskId) => {
                        if (subtaskId) {
                          setFocusedSubtaskMap((prev) => {
                            const newMap = new Map(prev);
                            newMap.set(task.id, subtaskId);
                            return newMap;
                          });
                        } else {
                          setFocusedSubtaskMap((prev) => {
                            const newMap = new Map(prev);
                            newMap.delete(task.id);
                            return newMap;
                          });
                        }
                      }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* New task input */}
      {isCreating && (
        <div className="p-4 border-t border-[var(--border-primary)]">
          <div className="relative">
            <input
              ref={newTaskInputRef}
              type="text"
              value={newTaskText}
              onChange={handleNewTaskChange}
              onKeyDown={handleNewTaskKeyDown}
              onBlur={() => {
                if (!newTaskText.trim()) {
                  setIsCreating(false);
                }
              }}
              placeholder="Enter task... (use @ for file mentions)"
              className="w-full bg-[var(--bg-elevated)] text-[#E6E6E6] px-4 py-3 border border-[var(--accent-orange)] outline-none text-sm font-mono"
            />
            {showAutocomplete && shouldShowFileTree && (
              <FileAutocomplete
                files={projectFiles}
                query={autocompleteQuery}
                onSelect={handleFileSelect}
                onClose={() => setShowAutocomplete(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Keyboard shortcut hints */}
      {!isCreating && (
        <div className="keyboard-shortcuts-bar flex items-center gap-4 p-3 border-t border-[var(--border-primary)] overflow-x-auto flex-nowrap bg-[var(--bg-elevated)]">
          <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">↑↓</kbd>
            <span className="text-[var(--text-secondary)] text-xs font-mono uppercase">NAVIGATE</span>
          </div>
          <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">SPACE</kbd>
            <span className="text-[var(--text-secondary)] text-xs font-mono uppercase">TOGGLE</span>
          </div>
          <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">N</kbd>
            <span className="text-[var(--text-secondary)] text-xs font-mono uppercase">NEW TASK</span>
          </div>
          <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
            <span className="text-[var(--text-dim)]">+</span>
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">F</kbd>
            <span className="text-[var(--text-secondary)] text-xs font-mono uppercase">FORMAT</span>
          </div>
          <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
            <span className="text-[var(--text-dim)]">+</span>
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">SHIFT</kbd>
            <span className="text-[var(--text-dim)]">+</span>
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">F</kbd>
            <span className="text-[var(--text-secondary)] text-xs font-mono uppercase">NO CONTEXT</span>
          </div>
          <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">1-5</kbd>
            <span className="text-[var(--text-secondary)] text-xs font-mono uppercase">FILTER</span>
          </div>
          <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
            <kbd className="px-3 py-1.5 border border-[var(--text-primary)] text-[var(--text-primary)] text-xs font-mono bg-transparent min-w-[32px] text-center">C</kbd>
            <span className="text-[var(--text-secondary)] text-xs font-mono uppercase">DESELECT</span>
          </div>
        </div>
      )}

      {/* Relationship Editor Modal */}
      {editingRelationshipsTaskId && (
        <RelationshipEditor
          task={flatTasks.find((t) => t.id === editingRelationshipsTaskId)!}
          allTasks={flatTasks}
          onSave={handleRelationshipsSave}
          onClose={() => setEditingRelationshipsTaskId(null)}
        />
      )}
    </div>
  );
};

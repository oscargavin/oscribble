import { useEffect, useRef } from "react";
import { TaskNode } from "../../../types";
import { FilterMode } from "../utils/types";

interface UseKeyboardShortcutsProps {
  containerRef: React.RefObject<HTMLDivElement>;
  focusedTaskId: string | null;
  setFocusedTaskId: (id: string | null) => void;
  selectedTaskIds: Set<string>;
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  focusedSubtaskMap: Map<string, string>;
  setFocusedSubtaskMap: React.Dispatch<
    React.SetStateAction<Map<string, string>>
  >;
  displayTasks: TaskNode[];
  flatTasks: TaskNode[];
  tasks: TaskNode[];
  expandedTasks: Set<string>;
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  setIsCreating: (value: boolean) => void;
  setEditingRelationshipsTaskId: (id: string | null) => void;
  handleToggleExpand: (id: string) => void;
  handleToggle: (id: string) => void;
  handleDelete: (id: string) => void;
  handleFormat: (id: string, useAutocontext?: boolean) => void;
  handleBatchToggle: () => void;
  handleBatchDelete: () => void;
  copyTaskToClipboard: (task: TaskNode) => Promise<void>;
  copyAllTasks: () => Promise<void>;
  clearAllTasks: () => void;
  setShowContextFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  shouldShowFileTree: boolean;
}

/**
 * Hook for managing all keyboard shortcuts
 */
export const useKeyboardShortcuts = ({
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
  copyAllTasks,
  clearAllTasks,
  setShowContextFiles,
  shouldShowFileTree,
}: UseKeyboardShortcutsProps) => {
  const navigationScheduledRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when container is mounted and not in an input
      if (!containerRef.current) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      // Number keys to switch filter mode
      if (e.key === "1") {
        e.preventDefault();
        setFilterMode("unchecked");
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        setFilterMode("all");
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        setFilterMode("complete");
        return;
      }
      if (e.key === "4") {
        e.preventDefault();
        setFilterMode("high");
        return;
      }
      if (e.key === "5") {
        e.preventDefault();
        setFilterMode("blocked");
        return;
      }

      // N key to create new task
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setIsCreating(true);
        return;
      }

      // R key to edit relationships
      if ((e.key === "r" || e.key === "R") && focusedTaskId) {
        e.preventDefault();
        setEditingRelationshipsTaskId(focusedTaskId);
        return;
      }

      // ArrowRight to expand and focus first incomplete subtask
      if (e.key === "ArrowRight" && focusedTaskId) {
        e.preventDefault();
        const task = flatTasks.find((t) => t.id === focusedTaskId);
        if (task && task.subtasks && task.subtasks.length > 0) {
          // Find first incomplete subtask, or first subtask if all complete
          const firstIncompleteSubtask = task.subtasks.find(
            (st) => !st.checked
          );
          const targetSubtask = firstIncompleteSubtask || task.subtasks[0];

          if (!expandedTasks.has(focusedTaskId)) {
            // Expand the task
            handleToggleExpand(focusedTaskId);
          }

          // Focus first incomplete subtask (or first subtask if all complete)
          setFocusedSubtaskMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(focusedTaskId, targetSubtask.id);
            return newMap;
          });
        }
        return;
      }
      // ArrowLeft to collapse (exits subtask navigation automatically)
      else if (e.key === "ArrowLeft" && focusedTaskId) {
        e.preventDefault();
        const task = flatTasks.find((t) => t.id === focusedTaskId);
        if (task && task.subtasks && task.subtasks.length > 0) {
          // Collapse the task (this will automatically exit subtask navigation)
          if (expandedTasks.has(focusedTaskId)) {
            handleToggleExpand(focusedTaskId);
            // Exit subtask navigation
            setFocusedSubtaskMap((prev) => {
              const newMap = new Map(prev);
              newMap.delete(focusedTaskId);
              return newMap;
            });
          }
        }
        return;
      }
      // Arrow navigation (use displayTasks for filtered navigation)
      else if (e.key === "ArrowDown") {
        e.preventDefault();

        // Cancel any pending navigation
        if (navigationScheduledRef.current !== null) {
          cancelAnimationFrame(navigationScheduledRef.current);
        }

        // Schedule navigation for next frame to throttle rapid keypresses
        navigationScheduledRef.current = requestAnimationFrame(() => {
          // Check if we're in subtask navigation mode
          if (focusedTaskId && focusedSubtaskMap.has(focusedTaskId)) {
            const task = flatTasks.find((t) => t.id === focusedTaskId);
            if (task && task.subtasks) {
              const currentSubtaskId = focusedSubtaskMap.get(focusedTaskId);
              const currentIndex = task.subtasks.findIndex(
                (s) => s.id === currentSubtaskId
              );
              const nextIndex =
                currentIndex < task.subtasks.length - 1 ? currentIndex + 1 : 0;

              setFocusedSubtaskMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(focusedTaskId, task.subtasks![nextIndex].id);
                return newMap;
              });
            }
          } else if (!focusedTaskId && displayTasks.length > 0) {
            setFocusedTaskId(displayTasks[0].id);
            if (!e.shiftKey) {
              setSelectedTaskIds(new Set());
            }
          } else if (focusedTaskId) {
            const currentIndex = displayTasks.findIndex(
              (t) => t.id === focusedTaskId
            );
            const nextIndex =
              currentIndex < displayTasks.length - 1 ? currentIndex + 1 : 0;
            const nextTaskId = displayTasks[nextIndex].id;

            if (e.shiftKey) {
              // Extend selection
              setSelectedTaskIds((prev) => {
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

            // Auto-expand and focus first incomplete subtask if the next task has subtasks
            // (Only for code projects - life_admin projects should expand manually)
            const nextTask = displayTasks[nextIndex];
            if (
              shouldShowFileTree &&
              nextTask.subtasks &&
              nextTask.subtasks.length > 0
            ) {
              if (!expandedTasks.has(nextTaskId)) {
                handleToggleExpand(nextTaskId);
              }
              // Focus first incomplete subtask (or first subtask if all complete)
              const firstIncompleteSubtask = nextTask.subtasks.find(
                (st) => !st.checked
              );
              const targetSubtask =
                firstIncompleteSubtask || nextTask.subtasks[0];
              setFocusedSubtaskMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(nextTaskId, targetSubtask.id);
                return newMap;
              });
            }
          }
          navigationScheduledRef.current = null;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();

        // Cancel any pending navigation
        if (navigationScheduledRef.current !== null) {
          cancelAnimationFrame(navigationScheduledRef.current);
        }

        // Schedule navigation for next frame to throttle rapid keypresses
        navigationScheduledRef.current = requestAnimationFrame(() => {
          // Check if we're in subtask navigation mode
          if (focusedTaskId && focusedSubtaskMap.has(focusedTaskId)) {
            const task = flatTasks.find((t) => t.id === focusedTaskId);
            if (task && task.subtasks) {
              const currentSubtaskId = focusedSubtaskMap.get(focusedTaskId);
              const currentIndex = task.subtasks.findIndex(
                (s) => s.id === currentSubtaskId
              );
              const prevIndex =
                currentIndex > 0 ? currentIndex - 1 : task.subtasks.length - 1;

              setFocusedSubtaskMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(focusedTaskId, task.subtasks![prevIndex].id);
                return newMap;
              });
            }
          } else if (focusedTaskId) {
            const currentIndex = displayTasks.findIndex(
              (t) => t.id === focusedTaskId
            );
            const prevIndex =
              currentIndex > 0 ? currentIndex - 1 : displayTasks.length - 1;
            const prevTaskId = displayTasks[prevIndex].id;

            if (e.shiftKey) {
              // Extend selection
              setSelectedTaskIds((prev) => {
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

            // Auto-expand and focus first incomplete subtask if the previous task has subtasks
            // (Only for code projects - life_admin projects should expand manually)
            const prevTask = displayTasks[prevIndex];
            if (
              shouldShowFileTree &&
              prevTask.subtasks &&
              prevTask.subtasks.length > 0
            ) {
              if (!expandedTasks.has(prevTaskId)) {
                handleToggleExpand(prevTaskId);
              }
              // Focus first incomplete subtask (or first subtask if all complete)
              const firstIncompleteSubtask = prevTask.subtasks.find(
                (st) => !st.checked
              );
              const targetSubtask =
                firstIncompleteSubtask || prevTask.subtasks[0];
              setFocusedSubtaskMap((prev) => {
                const newMap = new Map(prev);
                newMap.set(prevTaskId, targetSubtask.id);
                return newMap;
              });
            }
          }
          navigationScheduledRef.current = null;
        });
      }
      // Space to toggle
      else if (e.key === " " && focusedTaskId) {
        e.preventDefault();
        // Toggle selected tasks if any are selected, otherwise toggle focused task/subtask
        if (selectedTaskIds.size > 0) {
          handleBatchToggle();
        } else {
          // Check if we're in subtask navigation mode
          if (focusedSubtaskMap.has(focusedTaskId)) {
            const focusedSubtaskId = focusedSubtaskMap.get(focusedTaskId);
            if (focusedSubtaskId) {
              handleToggle(focusedSubtaskId);
            }
          } else {
            handleToggle(focusedTaskId);
          }
        }
      }
      // Delete key
      else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        focusedTaskId
      ) {
        e.preventDefault();
        // Delete selected tasks if any are selected, otherwise delete focused task/subtask
        if (selectedTaskIds.size > 0) {
          handleBatchDelete();
        } else {
          // Check if we're in subtask navigation mode
          if (focusedSubtaskMap.has(focusedTaskId)) {
            const focusedSubtaskId = focusedSubtaskMap.get(focusedTaskId);
            if (focusedSubtaskId) {
              handleDelete(focusedSubtaskId);
            }
          } else {
            handleDelete(focusedTaskId);
          }
        }
      }
      // Cmd+C to copy focused task
      else if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "c" &&
        focusedTaskId &&
        !e.shiftKey
      ) {
        const task = flatTasks.find((t) => t.id === focusedTaskId);
        if (task) {
          e.preventDefault();
          copyTaskToClipboard(task);
        }
      }
      // Cmd+Shift+C to copy all tasks
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        copyAllTasks();
      }
      // Cmd+L to clear all
      else if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        clearAllTasks();
      }
      // Cmd+F to format focused task WITH autocontext
      // Cmd+Shift+F to format focused task WITHOUT autocontext
      else if ((e.metaKey || e.ctrlKey) && e.key === "f" && focusedTaskId) {
        e.preventDefault();
        const task = flatTasks.find((t) => t.id === focusedTaskId);
        // Only format if task is unformatted
        if (task && task.metadata?.formatted === false) {
          // e.shiftKey determines whether to use autocontext
          handleFormat(focusedTaskId, !e.shiftKey);
        }
      }
      // Cmd+O to toggle context files visibility for focused/selected tasks
      else if ((e.metaKey || e.ctrlKey) && e.key === "o" && focusedTaskId) {
        e.preventDefault();
        setShowContextFiles((prev) => {
          const newSet = new Set(prev);

          // If there are selected tasks, toggle all of them
          if (selectedTaskIds.size > 0) {
            // Check if all selected tasks are currently visible
            const allVisible = Array.from(selectedTaskIds).every((id) =>
              newSet.has(id)
            );

            if (allVisible) {
              // Hide all selected tasks
              selectedTaskIds.forEach((id) => newSet.delete(id));
            } else {
              // Show all selected tasks
              selectedTaskIds.forEach((id) => newSet.add(id));
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
      else if (
        (e.key === "c" || e.key === "C") &&
        (focusedTaskId || selectedTaskIds.size > 0)
      ) {
        // Only trigger if not using Cmd/Ctrl (to avoid conflict with copy)
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setFocusedTaskId(null);
          setSelectedTaskIds(new Set());
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    focusedTaskId,
    displayTasks,
    flatTasks,
    tasks,
    expandedTasks,
    selectedTaskIds,
    focusedSubtaskMap,
    filterMode,
    containerRef,
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
    copyAllTasks,
    clearAllTasks,
    setShowContextFiles,
    shouldShowFileTree,
    setFocusedTaskId,
    setSelectedTaskIds,
    setFocusedSubtaskMap,
  ]);
};

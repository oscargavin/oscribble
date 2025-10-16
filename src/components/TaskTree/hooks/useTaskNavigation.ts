import { useState, useEffect, useRef } from "react";
import { TaskNode } from "../../../types";

/**
 * Hook for managing task focus, selection, and scrolling
 */
export const useTaskNavigation = (
  tasks: TaskNode[],
  projectName: string,
  taskContainerRef: React.RefObject<HTMLDivElement>,
  scrollContainerRef: React.RefObject<HTMLDivElement>
) => {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    new Set()
  );
  const [focusedSubtaskMap, setFocusedSubtaskMap] = useState<
    Map<string, string>
  >(new Map());

  const prevTaskCountRef = useRef(tasks.length);
  const prevProjectNameRef = useRef(projectName);

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only handle if we have a focused task or selected tasks
      if (!focusedTaskId && selectedTaskIds.size === 0) return;

      const target = e.target as HTMLElement;

      // Check if click is outside the task container
      if (
        taskContainerRef.current &&
        !taskContainerRef.current.contains(target)
      ) {
        // Clear both focus and selection
        setFocusedTaskId(null);
        setSelectedTaskIds(new Set());
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [focusedTaskId, selectedTaskIds, taskContainerRef]);

  // Scroll focused task into view
  useEffect(() => {
    if (focusedTaskId) {
      const element = document.querySelector(
        `[data-task-id="${focusedTaskId}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [focusedTaskId]);

  // Scroll focused subtask into view
  useEffect(() => {
    if (focusedTaskId && focusedSubtaskMap.has(focusedTaskId)) {
      const focusedSubtaskId = focusedSubtaskMap.get(focusedTaskId);
      if (focusedSubtaskId) {
        const element = document.querySelector(
          `[data-subtask-id="${focusedSubtaskId}"]`
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, [focusedTaskId, focusedSubtaskMap]);

  // Scroll to bottom when new tasks are added
  useEffect(() => {
    const currentTaskCount = tasks.length;
    const prevTaskCount = prevTaskCountRef.current;
    const currentProjectName = projectName;
    const prevProjectName = prevProjectNameRef.current;

    // Only scroll if:
    // 1. We're on the SAME project (not switching/loading)
    // 2. AND tasks were added (not removed or just updated)
    // 3. AND we had tasks before (prevTaskCount > 0, so this is an append, not a load)
    const isSameProject = currentProjectName === prevProjectName;
    const tasksWereAdded = currentTaskCount > prevTaskCount;
    const hadTasksBefore = prevTaskCount > 0;

    if (
      isSameProject &&
      tasksWereAdded &&
      hadTasksBefore &&
      scrollContainerRef.current
    ) {
      // Use setTimeout to ensure DOM has updated with new tasks
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 50);
    }

    // Update the previous count and project name
    prevTaskCountRef.current = currentTaskCount;
    prevProjectNameRef.current = currentProjectName;
  }, [tasks, projectName, scrollContainerRef]);

  return {
    focusedTaskId,
    setFocusedTaskId,
    selectedTaskIds,
    setSelectedTaskIds,
    focusedSubtaskMap,
    setFocusedSubtaskMap,
  };
};

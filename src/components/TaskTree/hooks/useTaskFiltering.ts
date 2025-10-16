import { useMemo } from "react";
import { TaskNode } from "../../../types";
import { FilterMode } from "../utils/types";

/**
 * Hook for flattening and filtering tasks
 */
export const useTaskFiltering = (
  tasks: TaskNode[],
  filterMode: FilterMode,
  expandedTasks: Set<string>
) => {
  // Flatten tasks for navigation
  const flattenTasks = useMemo(() => {
    const flatten = (
      taskList: TaskNode[],
      currentExpanded: Set<string> = expandedTasks
    ): TaskNode[] => {
      const result: TaskNode[] = [];
      for (const task of taskList) {
        result.push(task);

        // Subtasks are rendered INSIDE TaskRow as a timeline - don't flatten them
        // Only flatten hierarchical children (for code projects with nested structure)
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;

        if (!hasSubtasks && task.children.length > 0) {
          // Only include hierarchical children if NO subtasks exist
          result.push(...flatten(task.children, currentExpanded));
        }
      }
      return result;
    };

    return flatten(tasks, expandedTasks);
  }, [tasks, expandedTasks]);

  // Apply filter to flat tasks
  const displayTasks = useMemo(() => {
    const applyFilter = (taskList: TaskNode[]): TaskNode[] => {
      switch (filterMode) {
        case "unchecked":
          return taskList.filter((task) => !task.checked);
        case "complete":
          return taskList.filter((task) => task.checked);
        case "high":
          return taskList.filter((task) => task.metadata?.priority === "high");
        case "blocked":
          return taskList.filter(
            (task) =>
              task.metadata?.blocked_by && task.metadata.blocked_by.length > 0
          );
        default:
          return taskList;
      }
    };

    return applyFilter(flattenTasks);
  }, [flattenTasks, filterMode]);

  return {
    flatTasks: flattenTasks,
    displayTasks,
  };
};

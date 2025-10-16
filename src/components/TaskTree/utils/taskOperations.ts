import { TaskNode } from "../../../types";

/**
 * Toggle task checked state recursively
 */
export const toggleTask = (tasks: TaskNode[], taskId: string): TaskNode[] => {
  return tasks.map((task) => {
    if (task.id === taskId) {
      return { ...task, checked: !task.checked };
    }
    if (task.children.length > 0) {
      return { ...task, children: toggleTask(task.children, taskId) };
    }
    if (task.subtasks && task.subtasks.length > 0) {
      return { ...task, subtasks: toggleTask(task.subtasks, taskId) };
    }
    return task;
  });
};

/**
 * Delete task from tree recursively
 */
export const deleteTask = (tasks: TaskNode[], taskId: string): TaskNode[] => {
  return tasks.filter((task) => {
    if (task.id === taskId) {
      return false;
    }
    if (task.children.length > 0) {
      task.children = deleteTask(task.children, taskId);
    }
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks = deleteTask(task.subtasks, taskId);
    }
    return true;
  });
};

/**
 * Update task text recursively
 */
export const updateTaskText = (
  tasks: TaskNode[],
  taskId: string,
  text: string
): TaskNode[] => {
  return tasks.map((task) => {
    if (task.id === taskId) {
      return { ...task, text };
    }
    if (task.children.length > 0) {
      return { ...task, children: updateTaskText(task.children, taskId, text) };
    }
    if (task.subtasks && task.subtasks.length > 0) {
      return {
        ...task,
        subtasks: updateTaskText(task.subtasks, taskId, text),
      };
    }
    return task;
  });
};

/**
 * Update task metadata recursively
 */
export const updateTaskMetadata = (
  tasks: TaskNode[],
  taskId: string,
  metadata: TaskNode["metadata"]
): TaskNode[] => {
  return tasks.map((task) => {
    if (task.id === taskId) {
      return { ...task, metadata };
    }
    if (task.children.length > 0) {
      return {
        ...task,
        children: updateTaskMetadata(task.children, taskId, metadata),
      };
    }
    if (task.subtasks && task.subtasks.length > 0) {
      return {
        ...task,
        subtasks: updateTaskMetadata(task.subtasks, taskId, metadata),
      };
    }
    return task;
  });
};

/**
 * Update task indent level recursively
 */
export const updateTaskIndent = (
  tasks: TaskNode[],
  taskId: string,
  delta: number
): TaskNode[] => {
  return tasks.map((task) => {
    if (task.id === taskId) {
      return { ...task, indent: Math.max(0, task.indent + delta) };
    }
    if (task.children.length > 0) {
      return {
        ...task,
        children: updateTaskIndent(task.children, taskId, delta),
      };
    }
    if (task.subtasks && task.subtasks.length > 0) {
      return {
        ...task,
        subtasks: updateTaskIndent(task.subtasks, taskId, delta),
      };
    }
    return task;
  });
};

/**
 * Copy task to clipboard with formatting
 */
export const copyTaskToClipboard = async (task: TaskNode): Promise<void> => {
  let copyText = task.text;
  if (task.metadata?.priority) {
    copyText += `\nPriority: ${task.metadata.priority}`;
  }
  if (task.metadata?.notes && task.metadata.notes.length > 0) {
    copyText += `\nNotes:\n${task.metadata.notes.map((note) => `  - ${note}`).join("\n")}`;
  }
  if (task.metadata?.deadline) {
    copyText += `\nDeadline: ${task.metadata.deadline}`;
  }
  if (task.metadata?.effort_estimate) {
    copyText += `\nEstimate: ${task.metadata.effort_estimate}`;
  }
  if (task.metadata?.tags && task.metadata.tags.length > 0) {
    copyText += `\nTags: ${task.metadata.tags.join(", ")}`;
  }
  if (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) {
    copyText += `\nBlocked by: ${task.metadata.blocked_by.join(", ")}`;
  }
  if (task.metadata?.depends_on && task.metadata.depends_on.length > 0) {
    copyText += `\nDepends on: ${task.metadata.depends_on.join(", ")}`;
  }
  if (task.metadata?.related_to && task.metadata.related_to.length > 0) {
    copyText += `\nRelated: ${task.metadata.related_to.join(", ")}`;
  }
  try {
    await navigator.clipboard.writeText(copyText);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
};

/**
 * Copy all tasks to clipboard
 */
export const copyAllTasks = async (flatTasks: TaskNode[]): Promise<void> => {
  const allTasksText = flatTasks
    .map((task) => {
      let text = task.text;
      if (task.metadata?.priority) {
        text += ` [${task.metadata.priority}]`;
      }
      return text;
    })
    .join("\n");

  try {
    await navigator.clipboard.writeText(allTasksText);
  } catch (err) {
    console.error("Failed to copy all:", err);
  }
};

/**
 * Clear visible tasks from tree (respects filter mode)
 */
export const clearVisibleTasks = (
  tasks: TaskNode[],
  visibleTaskIds: Set<string>
): TaskNode[] => {
  const deleteRecursive = (taskList: TaskNode[]): TaskNode[] => {
    return taskList.filter((task) => {
      if (visibleTaskIds.has(task.id)) {
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

  return deleteRecursive(tasks);
};

/**
 * Batch toggle multiple tasks
 */
export const batchToggleTasks = (
  tasks: TaskNode[],
  taskIds: Set<string>
): TaskNode[] => {
  let result = tasks;
  taskIds.forEach((taskId) => {
    result = toggleTask(result, taskId);
  });
  return result;
};

/**
 * Batch delete multiple tasks
 */
export const batchDeleteTasks = (
  tasks: TaskNode[],
  taskIds: Set<string>
): TaskNode[] => {
  let result = tasks;
  taskIds.forEach((taskId) => {
    result = deleteTask(result, taskId);
  });
  return result;
};

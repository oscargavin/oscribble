import { TaskNode } from '../types';

/**
 * Compressed task representation for context efficiency
 */
export interface CompressedTask {
  id: string;
  title: string;
  text?: string;
  priority?: 'high' | 'medium' | 'low';
  checked?: boolean;
  depends_on?: string[];
  related_to?: string[];
}

/**
 * Extract keywords from raw task text for semantic matching
 */
export function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'need'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 20); // Limit to 20 keywords
}

/**
 * Check if task text matches any keywords
 */
export function hasKeywordMatch(task: TaskNode, keywords: string[]): boolean {
  if (keywords.length === 0) return false;

  const taskText = task.text.toLowerCase();
  const taskNotes = task.metadata?.notes?.join(' ').toLowerCase() || '';
  const taskTags = task.metadata?.tags?.join(' ').toLowerCase() || '';
  const searchText = `${taskText} ${taskNotes} ${taskTags}`;

  return keywords.some(keyword => searchText.includes(keyword));
}

/**
 * Check if task was completed recently (within N days)
 */
export function isRecentlyCompleted(task: TaskNode, days: number): boolean {
  if (!task.checked || !task.metadata?.duration) return false;

  const completedAt = task.metadata.start_time! + task.metadata.duration;
  const daysAgo = Date.now() - (days * 24 * 60 * 60 * 1000);

  return completedAt > daysAgo;
}

/**
 * Check if task has dependencies
 */
export function hasDependencies(task: TaskNode): boolean {
  return !!(
    (task.metadata?.depends_on && task.metadata.depends_on.length > 0) ||
    (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) ||
    (task.metadata?.related_to && task.metadata.related_to.length > 0)
  );
}

/**
 * Check if task is high priority
 */
export function isHighPriority(task: TaskNode): boolean {
  return task.metadata?.priority === 'high';
}

/**
 * Flatten nested task tree into array
 */
export function flattenTasks(tasks: TaskNode[]): TaskNode[] {
  const result: TaskNode[] = [];

  function traverse(taskList: TaskNode[]) {
    for (const task of taskList) {
      result.push(task);
      if (task.children.length > 0) {
        traverse(task.children);
      }
      if (task.subtasks && task.subtasks.length > 0) {
        traverse(task.subtasks);
      }
    }
  }

  traverse(tasks);
  return result;
}

/**
 * Compress task to minimal representation
 */
export function compressTask(task: TaskNode, level: 'full' | 'minimal'): CompressedTask {
  const title = task.metadata?.title || generateTitleFromText(task.text);

  if (level === 'minimal') {
    return {
      id: task.id,
      title,
    };
  }

  // Full compression
  return {
    id: task.id,
    title,
    text: task.text,
    priority: task.metadata?.priority,
    checked: task.checked,
    depends_on: task.metadata?.depends_on,
    related_to: task.metadata?.related_to,
  };
}

/**
 * Generate a title from task text if none exists
 */
export function generateTitleFromText(text: string): string {
  // Convert task text to kebab-case title
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 4)
    .join('-')
    .substring(0, 50);
}

/**
 * Filter tasks for Claude context based on relevance
 */
export function filterRelevantTasks(
  allTasks: TaskNode[],
  newTaskKeywords: string[],
  options: {
    maxTasks?: number;
    includeDays?: number;
  } = {}
): TaskNode[] {
  const { maxTasks = 50, includeDays = 7 } = options;

  const flatTasks = flattenTasks(allTasks);

  // Score and filter tasks
  const scored = flatTasks.map(task => {
    let score = 0;

    // Always include uncompleted tasks (high score)
    if (!task.checked) score += 100;

    // Recently completed tasks
    if (isRecentlyCompleted(task, includeDays)) score += 50;

    // High priority tasks
    if (isHighPriority(task)) score += 30;

    // Tasks with dependencies
    if (hasDependencies(task)) score += 20;

    // Semantic relevance
    if (hasKeywordMatch(task, newTaskKeywords)) score += 40;

    return { task, score };
  });

  // Sort by score and take top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTasks)
    .map(({ task }) => task);
}

/**
 * Build context string for Claude from filtered tasks
 */
export function buildTaskContext(tasks: TaskNode[]): string {
  if (tasks.length === 0) return '';

  const compressed = tasks.map(task => {
    const level = !task.checked || isHighPriority(task) ? 'full' : 'minimal';
    return compressTask(task, level);
  });

  return `\nExisting tasks (for dependency references):\n${JSON.stringify(compressed, null, 2)}`;
}

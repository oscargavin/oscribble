import { TaskNode, ClaudeTask } from '../types';
import { flattenTasks, generateTitleFromText } from './contextManager';

/**
 * Map dependency references (titles or indices) to actual UUIDs
 */
export function mapDependencyReferences(
  references: (string | number)[] | undefined,
  newTasks: TaskNode[],
  existingTasks: TaskNode[]
): string[] {
  if (!references || references.length === 0) return [];

  const titleToIdMap = new Map<string, string>();

  // Build map of titles to IDs from existing tasks
  const flatExisting = flattenTasks(existingTasks);
  flatExisting.forEach(task => {
    const title = task.metadata?.title || generateTitleFromText(task.text);
    titleToIdMap.set(title, task.id);
  });

  // Map references to UUIDs
  const uuids: string[] = [];

  for (const ref of references) {
    if (typeof ref === 'number') {
      // Index reference - refers to new task in same batch
      if (ref >= 0 && ref < newTasks.length) {
        uuids.push(newTasks[ref].id);
      }
    } else {
      // Title reference - refers to existing task
      const uuid = titleToIdMap.get(ref);
      if (uuid) {
        uuids.push(uuid);
      }
    }
  }

  return uuids;
}

/**
 * Ensure task has a title, generating one if needed
 */
export function ensureTaskTitle(task: ClaudeTask | TaskNode): string {
  if ('metadata' in task) {
    // TaskNode
    return task.metadata?.title || generateTitleFromText(task.text);
  } else {
    // ClaudeTask
    return (task as ClaudeTask).title || generateTitleFromText(task.text);
  }
}

/**
 * Convert mixed references (strings/numbers) to ensure they're properly typed
 */
export function normalizeReferences(
  refs: any[] | undefined
): (string | number)[] {
  if (!refs || !Array.isArray(refs)) return [];

  return refs.map(ref => {
    if (typeof ref === 'number') return ref;
    if (typeof ref === 'string') {
      // Check if it's a numeric string like "0" or "1"
      const num = parseInt(ref, 10);
      if (!isNaN(num) && num.toString() === ref) {
        return num;
      }
      return ref;
    }
    return ref;
  }).filter(ref => typeof ref === 'string' || typeof ref === 'number');
}

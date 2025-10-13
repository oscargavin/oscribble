import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NotesFile, ProjectSettings, AppSettings, CompletionLog, CompletionLogEntry, PriorityLog, PriorityEditEntry } from '../types';

const APP_DIR = path.join(os.homedir(), '.project-stickies');

export class StorageService {
  /**
   * Initialize the storage directory structure
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(APP_DIR, { recursive: true });

      // Create default settings if they don't exist
      const settingsPath = path.join(APP_DIR, 'settings.json');
      try {
        await fs.access(settingsPath);
      } catch {
        const defaultSettings: AppSettings = {
          auth_method: 'api_key',
        };
        await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
      }

      // Create projects registry if it doesn't exist
      const projectsPath = path.join(APP_DIR, 'projects.json');
      try {
        await fs.access(projectsPath);
        // Deduplicate projects on startup (one-time fix)
        await this.deduplicateProjects();
      } catch {
        await fs.writeFile(projectsPath, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Get app settings
   */
  static async getSettings(): Promise<AppSettings> {
    const settingsPath = path.join(APP_DIR, 'settings.json');
    const data = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Save app settings
   */
  static async saveSettings(settings: AppSettings): Promise<void> {
    const settingsPath = path.join(APP_DIR, 'settings.json');
    await this.atomicWrite(settingsPath, JSON.stringify(settings, null, 2));
  }

  /**
   * Get all projects
   */
  static async getProjects(): Promise<ProjectSettings[]> {
    const projectsPath = path.join(APP_DIR, 'projects.json');
    const data = await fs.readFile(projectsPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Add a new project
   */
  static async addProject(project: ProjectSettings): Promise<void> {
    const projects = await this.getProjects();

    // Check if project already exists
    const existingIndex = projects.findIndex(p => p.name === project.name);
    if (existingIndex !== -1) {
      // Update existing project instead of adding duplicate
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    const projectsPath = path.join(APP_DIR, 'projects.json');
    await this.atomicWrite(projectsPath, JSON.stringify(projects, null, 2));

    // Create project directory
    const projectDir = path.join(APP_DIR, project.name);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, '.context-cache'), { recursive: true });

    // Create empty notes.json if it doesn't exist (prevents file watcher errors)
    const notesPath = path.join(projectDir, 'notes.json');
    try {
      await fs.access(notesPath);
    } catch {
      const emptyNotes: NotesFile = {
        version: '1.0.0',
        project_path: project.path,
        last_modified: Date.now(),
        tasks: []
      };
      await this.atomicWrite(notesPath, JSON.stringify(emptyNotes, null, 2));
    }
  }

  /**
   * Update an existing project
   */
  static async updateProject(project: ProjectSettings): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex(p => p.name === project.name);

    if (index === -1) {
      throw new Error(`Project ${project.name} not found`);
    }

    projects[index] = project;
    const projectsPath = path.join(APP_DIR, 'projects.json');
    await this.atomicWrite(projectsPath, JSON.stringify(projects, null, 2));
  }

  /**
   * Get notes for a project
   */
  static async getNotes(projectName: string): Promise<NotesFile | null> {
    const notesPath = path.join(APP_DIR, projectName, 'notes.json');
    try {
      const data = await fs.readFile(notesPath, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate the parsed data has the expected structure
      if (parsed && typeof parsed === 'object') {
        return {
          version: parsed.version || '1.0',
          project_path: parsed.project_path || '',
          last_modified: parsed.last_modified || Date.now(),
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          last_formatted_raw: parsed.last_formatted_raw || '',
        };
      }
      return null;
    } catch (error) {
      // File doesn't exist or is invalid - this is expected for new projects
      return null;
    }
  }

  /**
   * Save notes for a project
   */
  static async saveNotes(projectName: string, notes: NotesFile): Promise<void> {
    const notesPath = path.join(APP_DIR, projectName, 'notes.json');
    await this.atomicWrite(notesPath, JSON.stringify(notes, null, 2));
  }

  /**
   * Save raw text (for autosave)
   */
  static async saveRawText(projectName: string, text: string): Promise<void> {
    const rawPath = path.join(APP_DIR, projectName, 'raw.txt');
    await this.atomicWrite(rawPath, text);
  }

  /**
   * Get raw text
   */
  static async getRawText(projectName: string): Promise<string | null> {
    const rawPath = path.join(APP_DIR, projectName, 'raw.txt');
    try {
      return await fs.readFile(rawPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Atomic write - write to temp file then rename
   */
  private static async atomicWrite(filePath: string, data: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, data, 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  /**
   * Remove duplicate projects (keep most recent last_accessed)
   */
  private static async deduplicateProjects(): Promise<void> {
    try {
      const projects = await this.getProjects();
      const seen = new Map<string, ProjectSettings>();

      // Keep only the most recently accessed version of each project
      for (const project of projects) {
        const existing = seen.get(project.name);
        if (!existing || project.last_accessed > existing.last_accessed) {
          seen.set(project.name, project);
        }
      }

      const deduplicated = Array.from(seen.values());

      // Only write if we found duplicates
      if (deduplicated.length < projects.length) {
        const projectsPath = path.join(APP_DIR, 'projects.json');
        await this.atomicWrite(projectsPath, JSON.stringify(deduplicated, null, 2));
        console.log(`Removed ${projects.length - deduplicated.length} duplicate projects`);
      }
    } catch (error) {
      console.error('Failed to deduplicate projects:', error);
    }
  }

  /**
   * Delete a project completely
   */
  static async deleteProject(projectName: string): Promise<void> {
    // Remove from projects registry
    const projects = await this.getProjects();
    const filtered = projects.filter(p => p.name !== projectName);
    const projectsPath = path.join(APP_DIR, 'projects.json');
    await this.atomicWrite(projectsPath, JSON.stringify(filtered, null, 2));

    // Delete project directory
    const projectDir = path.join(APP_DIR, projectName);
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete project directory for ${projectName}:`, error);
    }
  }

  /**
   * Get completion log for a project
   */
  static async getCompletionLog(projectName: string): Promise<CompletionLog> {
    const logPath = path.join(APP_DIR, projectName, 'completion_log.json');
    try {
      const data = await fs.readFile(logPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Return empty log if file doesn't exist
      return {
        version: '1.0.0',
        retention_policy: 'last_10',
        completions: []
      };
    }
  }

  /**
   * Save completion log for a project
   */
  static async saveCompletionLog(projectName: string, log: CompletionLog): Promise<void> {
    const logPath = path.join(APP_DIR, projectName, 'completion_log.json');
    await this.atomicWrite(logPath, JSON.stringify(log, null, 2));
  }

  /**
   * Append a completion entry to the log (with retention policy)
   */
  static async appendCompletion(projectName: string, entry: CompletionLogEntry): Promise<void> {
    const log = await this.getCompletionLog(projectName);
    log.completions.push(entry);

    // Apply retention policy - keep only last 10 completions
    if (log.completions.length > 10) {
      log.completions = log.completions.slice(-10);
    }

    await this.saveCompletionLog(projectName, log);
  }

  /**
   * Get recent completions for few-shot learning (default: last 10)
   */
  static async getRecentCompletions(projectName: string, limit: number = 10): Promise<CompletionLogEntry[]> {
    const log = await this.getCompletionLog(projectName);
    return log.completions.slice(-limit);
  }

  /**
   * Clear context cache older than specified days
   */
  static async clearOldCache(projectName: string, days: number = 7): Promise<void> {
    const cacheDir = path.join(APP_DIR, projectName, '.context-cache');
    try {
      const files = await fs.readdir(cacheDir);
      const now = Date.now();
      const maxAge = days * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to clear old cache:', error);
    }
  }

  /**
   * Get priority edit log for a project
   */
  static async getPriorityLog(projectName: string): Promise<PriorityLog> {
    const logPath = path.join(APP_DIR, projectName, 'priority_log.json');
    try {
      const data = await fs.readFile(logPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // Return empty log if file doesn't exist
      return {
        version: '1.0.0',
        retention_policy: 'last_100',
        edits: []
      };
    }
  }

  /**
   * Save priority edit log for a project
   */
  static async savePriorityLog(projectName: string, log: PriorityLog): Promise<void> {
    const logPath = path.join(APP_DIR, projectName, 'priority_log.json');
    await this.atomicWrite(logPath, JSON.stringify(log, null, 2));
  }

  /**
   * Append a priority edit entry to the log (with retention policy)
   */
  static async appendPriorityEdit(projectName: string, entry: PriorityEditEntry): Promise<void> {
    const log = await this.getPriorityLog(projectName);
    log.edits.push(entry);

    // Apply retention policy - keep only last 100 edits
    if (log.edits.length > 100) {
      log.edits = log.edits.slice(-100);
    }

    await this.savePriorityLog(projectName, log);
  }

  /**
   * Get recent priority edits for analysis (default: last 20)
   */
  static async getRecentPriorityEdits(projectName: string, limit: number = 20): Promise<PriorityEditEntry[]> {
    const log = await this.getPriorityLog(projectName);
    return log.edits.slice(-limit);
  }

  /**
   * Get priority edit statistics for learning insights
   */
  static async getPriorityEditStats(projectName: string): Promise<{
    totalEdits: number;
    upgradeCount: number;  // low->medium, low->high, medium->high
    downgradeCount: number; // high->medium, high->low, medium->low
    commonPatterns: Array<{ from: string; to: string; count: number }>;
  }> {
    const log = await this.getPriorityLog(projectName);

    const stats = {
      totalEdits: log.edits.length,
      upgradeCount: 0,
      downgradeCount: 0,
      commonPatterns: [] as Array<{ from: string; to: string; count: number }>
    };

    // Count pattern occurrences
    const patternMap = new Map<string, number>();

    for (const edit of log.edits) {
      const key = `${edit.original_priority}->${edit.edited_priority}`;
      patternMap.set(key, (patternMap.get(key) || 0) + 1);

      // Count upgrades/downgrades
      const priorityValue = { low: 1, medium: 2, high: 3 };
      const originalValue = priorityValue[edit.original_priority];
      const editedValue = priorityValue[edit.edited_priority];

      if (editedValue > originalValue) {
        stats.upgradeCount++;
      } else if (editedValue < originalValue) {
        stats.downgradeCount++;
      }
    }

    // Convert pattern map to sorted array
    stats.commonPatterns = Array.from(patternMap.entries())
      .map(([pattern, count]) => {
        const [from, to] = pattern.split('->');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count);

    return stats;
  }
}

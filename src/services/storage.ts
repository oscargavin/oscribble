import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NotesFile, ProjectSettings, AppSettings } from '../types';

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
}

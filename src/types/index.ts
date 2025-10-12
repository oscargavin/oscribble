export interface TaskNode {
  id: string;              // UUID
  text: string;
  checked: boolean;
  indent: number;          // 0-based nesting
  children: TaskNode[];
  metadata?: {
    priority?: 'critical' | 'performance' | 'feature';
    blocked_by?: string[]; // Array of task IDs
    notes?: string;        // Claude's insights
  };
}

export interface NotesFile {
  version: string;
  project_path: string;
  last_modified: number;
  tasks: TaskNode[];
  last_formatted_raw?: string; // Track what was last formatted
}

export interface ProjectSettings {
  name: string;
  path: string;
  created: number;
  last_accessed: number;
}

export interface AppSettings {
  auth_method: 'api_key' | 'subscription';
  current_project?: string;
  api_key?: string; // Store API key for persistence
}

export interface ClaudeFormatResponse {
  sections: ClaudeSection[];
  warnings: string[];
}

export interface ClaudeSection {
  category: string;
  priority: string;
  tasks: ClaudeTask[];
}

export interface ClaudeTask {
  text: string;
  notes: string[];
  blocked_by: string[];
  needs: string[];
}

export interface FileContext {
  path: string;
  content: string;
  dependencies?: string[];
}

export interface TaskNode {
  id: string;              // UUID
  text: string;
  checked: boolean;
  indent: number;          // 0-based nesting
  children: TaskNode[];
  subtasks?: TaskNode[];   // Explicit subtasks (distinct from hierarchical children)
  metadata?: {
    priority?: 'critical' | 'performance' | 'feature';
    blocked_by?: string[]; // Array of task IDs (legacy)
    depends_on?: string[]; // Task dependencies (replaces blocked_by)
    related_to?: string[]; // Related task IDs
    notes?: string[];      // Claude's insights as structured array
    deadline?: string;     // ISO date string or human-readable
    effort_estimate?: string; // e.g., "2h", "1d", "3 days"
    tags?: string[];       // Categorical tags
    formatted?: boolean;   // Whether task has been analyzed by Claude
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
  notes: string[];           // Structured array of insights
  blocked_by: string[];      // Legacy field
  depends_on?: string[];     // Task dependencies
  related_to?: string[];     // Related tasks
  needs: string[];           // Requirements
  deadline?: string;         // ISO date or human-readable
  effort_estimate?: string;  // Time estimate
  tags?: string[];           // Categorical tags
  subtasks?: ClaudeTask[];   // Nested subtasks
}

export interface FileContext {
  path: string;
  content: string;
  dependencies?: string[];
}

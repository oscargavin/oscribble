export interface TaskNode {
  id: string;              // UUID
  text: string;
  checked: boolean;
  indent: number;          // 0-based nesting
  children: TaskNode[];
  subtasks?: TaskNode[];   // Explicit subtasks (distinct from hierarchical children)
  metadata?: {
    priority?: 'high' | 'medium' | 'low';  // User-editable priority
    original_priority?: 'high' | 'medium' | 'low';  // Claude's original suggestion (for learning)
    priority_edited?: boolean; // Whether user has edited priority
    blocked_by?: string[]; // Array of task IDs (legacy)
    depends_on?: string[]; // Task dependencies (replaces blocked_by)
    related_to?: string[]; // Related task IDs
    notes?: string[];      // Claude's insights as structured array
    deadline?: string;     // ISO date string or human-readable
    effort_estimate?: string; // e.g., "2h", "1d", "3 days"
    tags?: string[];       // Categorical tags
    formatted?: boolean;   // Whether task has been analyzed by Claude
    context_files?: {      // Files that were analyzed to create this task
      path: string;
      wasGrepped?: boolean;
      matchedKeywords?: string[];
    }[];
    start_time?: number;   // Unix timestamp when task started (active if set && !duration)
    duration?: number;     // Milliseconds elapsed (presence means completed)
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
  api_key?: string; // Anthropic API key
  openai_api_key?: string; // OpenAI API key
}

export interface ClaudeFormatResponse {
  sections: ClaudeSection[];
  warnings: string[];
  context_used?: {
    file: string;
    reason: string;
  }[];
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

// Auto-context discovery types
export interface ContextDiscoveryRequest {
  rawText: string;
  projectRoot: string;
  fileTree: string;
}

export interface ContextDiscoveryResponse {
  explicit: string[];  // Files from @ mentions
  discovered: DiscoveredFile[];
  reasoning: string;  // Why Claude picked these files
}

export interface DiscoveredFile {
  file: string;
  readFully: boolean;
  keywords?: string[];  // Only if readFully = false
}

export interface FileContext {
  path: string;
  content: string;  // Full file or grep results
  lineCount?: number;
  wasGrepped?: boolean;
  matchedKeywords?: string[];  // If grepped
  dependencies?: string[];  // Legacy field for @mention context
}

export interface GatheredContext {
  files: FileContext[];
  totalLines: number;
  cacheHits: number;
  cacheMisses: number;
}

// Task completion tracking for time estimate learning
export interface CompletionLogEntry {
  task_id: string;
  text: string;
  estimated_time?: string;  // e.g., "4-6h"
  actual_time: number;      // Milliseconds
  completed_at: number;     // Unix timestamp
}

export interface CompletionLog {
  version: string;
  retention_policy: string; // e.g., "last_100"
  completions: CompletionLogEntry[];
}

// Priority edit tracking for learning feedback
export interface PriorityEditEntry {
  task_id: string;
  task_text: string;
  original_priority: 'high' | 'medium' | 'low';
  edited_priority: 'high' | 'medium' | 'low';
  edited_at: number;        // Unix timestamp
  task_context?: {          // Context that might inform future suggestions
    tags?: string[];
    deadline?: string;
    effort_estimate?: string;
    has_dependencies?: boolean;
  };
}

export interface PriorityLog {
  version: string;
  retention_policy: string; // e.g., "last_100"
  edits: PriorityEditEntry[];
}

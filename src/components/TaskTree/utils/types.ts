// Import and re-export types from parent
import type { TaskNode } from "../../../types";
export type { TaskNode } from "../../../types";

// Filter mode type
export type FilterMode = "all" | "unchecked" | "complete" | "high" | "blocked";

// Component prop types
export interface TaskTreeProps {
  tasks: TaskNode[];
  onUpdate: (tasks: TaskNode[]) => void;
  projectRoot: string;
  projectName: string;
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  showContextFiles: Set<string>;
  setShowContextFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  hasVoice?: boolean;
  shouldShowFileTree?: boolean;
}

export interface TaskRowProps {
  task: TaskNode;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndentChange: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onMetadataChange: (id: string, metadata: TaskNode["metadata"]) => void;
  onFormat: (id: string) => void;
  onFocus: (id: string) => void;
  isFocused: boolean;
  isSelected: boolean;
  isFirstSelected?: boolean;
  isLastSelected?: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  expandedTasks: Set<string>;
  isFormattingTaskId: string | null;
  depth?: number;
  showContextFiles: Set<string>;
  focusedSubtaskId?: string | null;
  onSubtaskFocus?: (subtaskId: string | null) => void;
}

export interface EmptyStateProps {
  filterMode: FilterMode;
  hasVoice?: boolean;
}

export interface RelationshipEditorProps {
  task: TaskNode;
  allTasks: TaskNode[];
  onSave: (taskId: string, dependsOn: string[], relatedTo: string[]) => void;
  onClose: () => void;
}

import { GatheredContext } from './index';

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ElectronAPI {
  initClaude: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  initOpenAI: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; data?: string; error?: string }>;
  getSettings: () => Promise<any>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getProjects: () => Promise<any[]>;
  addProject: (project: any) => Promise<{ success: boolean; error?: string }>;
  updateProject: (project: any) => Promise<{ success: boolean; error?: string }>;
  deleteProject: (projectName: string) => Promise<{ success: boolean; error?: string }>;
  getNotes: (projectName: string) => Promise<any>;
  saveNotes: (
    projectName: string,
    notes: any
  ) => Promise<{ success: boolean; error?: string }>;
  saveRaw: (
    projectName: string,
    text: string
  ) => Promise<{ success: boolean; error?: string }>;
  getRaw: (projectName: string) => Promise<string | null>;
  gatherContext: (
    rawText: string,
    projectRoot: string
  ) => Promise<{ success: boolean; context?: string; error?: string }>;
  gatherProjectContext: (rawText: string, projectRoot: string) => Promise<IPCResponse<GatheredContext>>;
  formatWithClaude: (
    rawText: string,
    contextStr: string,
    isVoiceInput?: boolean,
    projectName?: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  formatSingleTask: (
    taskText: string,
    projectRoot: string
  ) => Promise<{ success: boolean; data?: any; contextFiles?: { path: string; wasGrepped?: boolean; matchedKeywords?: string[]; }[]; error?: string }>;
  getProjectFiles: (
    projectRoot: string
  ) => Promise<{ success: boolean; files: string[]; error?: string }>;
  getDirectorySuggestions: (
    partialPath: string
  ) => Promise<{ success: boolean; directories: string[]; error?: string }>;
  selectDirectory: (
    defaultPath?: string
  ) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
  openProjectWindow: (
    projectName: string
  ) => Promise<{ success: boolean; error?: string }>;
  closeWindow: () => Promise<{ success: boolean }>;
  // File watching API
  startWatchingProject: (projectName: string) => Promise<{ success: boolean }>;
  stopWatchingProject: () => Promise<{ success: boolean }>;
  onNotesChanged: (callback: (projectName: string) => void) => () => void;
  // Task timing API
  startTaskTimer: (projectName: string, taskId: string) => Promise<{ success: boolean; start_time?: number; error?: string }>;
  completeTask: (projectName: string, taskId: string) => Promise<{ success: boolean; duration?: number; error?: string }>;
  getRecentCompletions: (projectName: string, limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

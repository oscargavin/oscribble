export interface ElectronAPI {
  initClaude: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
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
  formatWithClaude: (
    rawText: string,
    contextStr: string
  ) => Promise<{ success: boolean; data?: any; error?: string }>;
  getProjectFiles: (
    projectRoot: string
  ) => Promise<{ success: boolean; files: string[]; error?: string }>;
  getDirectorySuggestions: (
    partialPath: string
  ) => Promise<{ success: boolean; directories: string[]; error?: string }>;
  openProjectWindow: (
    projectName: string
  ) => Promise<{ success: boolean; error?: string }>;
  closeWindow: () => Promise<{ success: boolean }>;
  // File watching API
  startWatchingProject: (projectName: string) => Promise<{ success: boolean }>;
  stopWatchingProject: () => Promise<{ success: boolean }>;
  onNotesChanged: (callback: (projectName: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

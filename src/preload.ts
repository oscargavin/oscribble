// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose IPC methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  initClaude: (apiKey: string) => ipcRenderer.invoke('init-claude', apiKey),
  initOpenAI: (apiKey: string) => ipcRenderer.invoke('init-openai', apiKey),
  transcribeAudio: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  addProject: (project: any) => ipcRenderer.invoke('add-project', project),
  updateProject: (project: any) => ipcRenderer.invoke('update-project', project),
  deleteProject: (projectName: string) => ipcRenderer.invoke('delete-project', projectName),
  getNotes: (projectName: string) => ipcRenderer.invoke('get-notes', projectName),
  saveNotes: (projectName: string, notes: any) =>
    ipcRenderer.invoke('save-notes', projectName, notes),
  saveRaw: (projectName: string, text: string) =>
    ipcRenderer.invoke('save-raw', projectName, text),
  getRaw: (projectName: string) => ipcRenderer.invoke('get-raw', projectName),
  gatherContext: (rawText: string, projectRoot: string) =>
    ipcRenderer.invoke('gather-context', rawText, projectRoot),
  gatherProjectContext: (rawText: string, projectRoot: string) =>
    ipcRenderer.invoke('gather-project-context', rawText, projectRoot),
  formatWithClaude: (rawText: string, contextStr: string, isVoiceInput?: boolean, projectName?: string) =>
    ipcRenderer.invoke('format-with-claude', rawText, contextStr, isVoiceInput, projectName),
  formatSingleTask: (taskText: string, projectRoot: string) =>
    ipcRenderer.invoke('format-single-task', taskText, projectRoot),
  getProjectFiles: (projectRoot: string) =>
    ipcRenderer.invoke('get-project-files', projectRoot),
  getDirectorySuggestions: (partialPath: string) =>
    ipcRenderer.invoke('get-directory-suggestions', partialPath),
  selectDirectory: (defaultPath?: string) =>
    ipcRenderer.invoke('select-directory', defaultPath),
  openProjectWindow: (projectName: string) =>
    ipcRenderer.invoke('open-project-window', projectName),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  // File watching API
  startWatchingProject: (projectName: string) =>
    ipcRenderer.invoke('start-watching-project', projectName),
  stopWatchingProject: () => ipcRenderer.invoke('stop-watching-project'),
  onNotesChanged: (callback: (projectName: string) => void) => {
    const listener = (_event: any, projectName: string) => callback(projectName);
    ipcRenderer.on('notes-file-changed', listener);
    return () => ipcRenderer.removeListener('notes-file-changed', listener);
  },
  // Task timing API
  startTaskTimer: (projectName: string, taskId: string) =>
    ipcRenderer.invoke('start-task-timer', projectName, taskId),
  completeTask: (projectName: string, taskId: string) =>
    ipcRenderer.invoke('complete-task', projectName, taskId),
  getRecentCompletions: (projectName: string, limit?: number) =>
    ipcRenderer.invoke('get-recent-completions', projectName, limit),
  // Priority edit tracking API
  logPriorityEdit: (entry: any, projectName: string) =>
    ipcRenderer.invoke('log-priority-edit', entry, projectName),
  getRecentPriorityEdits: (projectName: string, limit?: number) =>
    ipcRenderer.invoke('get-recent-priority-edits', projectName, limit),
  getPriorityEditStats: (projectName: string) =>
    ipcRenderer.invoke('get-priority-edit-stats', projectName),
});

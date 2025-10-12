// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose IPC methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  initClaude: (apiKey: string) => ipcRenderer.invoke('init-claude', apiKey),
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
  formatWithClaude: (rawText: string, contextStr: string) =>
    ipcRenderer.invoke('format-with-claude', rawText, contextStr),
  formatSingleTask: (taskText: string, projectRoot: string) =>
    ipcRenderer.invoke('format-single-task', taskText, projectRoot),
  getProjectFiles: (projectRoot: string) =>
    ipcRenderer.invoke('get-project-files', projectRoot),
  getDirectorySuggestions: (partialPath: string) =>
    ipcRenderer.invoke('get-directory-suggestions', partialPath),
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
});

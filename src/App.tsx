import React, { useState, useEffect } from "react";
import { Setup } from "./components/Setup";
import { RawInput } from "./components/RawInput";
import { TaskTree } from "./components/TaskTree";
import { Settings } from "./components/Settings";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { TaskNode, NotesFile, ClaudeFormatResponse } from "./types";
import { v4 as uuidv4 } from "uuid";
import { useProjects } from "./hooks/useProjects";

type View = "setup" | "raw" | "tasks";

function App() {
  const [view, setView] = useState<View>("setup");
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectRoot, setProjectRoot] = useState("");
  const [rawText, setRawText] = useState("");
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [lastFormattedRaw, setLastFormattedRaw] = useState("");

  // Use the projects hook for centralized project state management
  const { projects, refreshProjects } = useProjects();

  // Check if setup is complete on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Check if project was passed via URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlProject = urlParams.get('project');

        const settings = await window.electronAPI.getSettings();

        // Determine which project to load:
        // 1. URL parameter (for new windows opened for specific projects)
        // 2. settings.current_project (for first window or last used)
        const targetProject = urlProject || settings?.current_project;

        if (targetProject) {
          // Re-initialize Claude with stored API key
          if (settings?.api_key) {
            setApiKey(settings.api_key);
            const initResult = await window.electronAPI.initClaude(
              settings.api_key
            );
            if (!initResult.success) {
              console.error(
                "Failed to re-initialize Claude:",
                initResult.error
              );
            }
          }

          setIsSetupComplete(true);
          setProjectName(targetProject);

          // Load project data
          const projects = await window.electronAPI.getProjects();
          const project = projects.find(
            (p: any) => p.name === targetProject
          );
          if (project) {
            setProjectRoot(project.path);
          }

          // Load raw text
          const raw = await window.electronAPI.getRaw(targetProject);
          if (raw) {
            setRawText(raw);
          }

          // Load notes (handle null case for projects with no tasks)
          const notes = await window.electronAPI.getNotes(targetProject);
          if (notes && notes.tasks && notes.tasks.length > 0) {
            setTasks(notes.tasks);
            setLastFormattedRaw(notes.last_formatted_raw || "");
            setView("tasks");
          } else {
            // Project has no tasks yet - start in raw view
            setTasks([]);
            setLastFormattedRaw("");
            setView("raw");
          }

          // If project was passed via URL, don't update global settings
          // This keeps windows independent
          if (!urlProject && settings && project) {
            // Update last_accessed for the current_project only if no URL param
            await window.electronAPI.updateProject({
              ...project,
              last_accessed: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error("Setup check failed:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSetup();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Quick switcher: Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }
      // New window: Cmd+N or Ctrl+N (opens current project in new window)
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        if (projectName) {
          handleOpenInNewWindow(projectName);
        }
      }
      // Close window: Cmd+W or Ctrl+W
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        handleCloseWindow();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [projectName]);

  // File watcher: Auto-reload tasks when external changes detected
  useEffect(() => {
    if (!projectName) return;

    // Start watching this project
    window.electronAPI.startWatchingProject(projectName);

    // Listen for file changes
    const unsubscribe = window.electronAPI.onNotesChanged(async (changedProject) => {
      // Only reload if the change is for our current project
      if (changedProject === projectName) {
        console.log('External change detected, reloading tasks...');
        try {
          const notes = await window.electronAPI.getNotes(projectName);
          if (notes && notes.tasks) {
            setTasks(notes.tasks);
            setLastFormattedRaw(notes.last_formatted_raw || "");
            // If we have tasks and we're in raw view, switch to tasks view
            if (notes.tasks.length > 0 && view === "raw") {
              setView("tasks");
            }
          }
        } catch (error) {
          console.error('Failed to reload tasks:', error);
        }
      }
    });

    // Cleanup: stop watching when component unmounts or project changes
    return () => {
      window.electronAPI.stopWatchingProject();
      unsubscribe();
    };
  }, [projectName, view]);

  const handleSetupComplete = async (newApiKey: string, path: string) => {
    setIsSetupComplete(true);
    setApiKey(newApiKey);
    const settings = await window.electronAPI.getSettings();
    setProjectName(settings.current_project);
    setProjectRoot(path);

    // Initialize empty state for new project
    setRawText("");
    setTasks([]);
    setLastFormattedRaw("");
    setView("raw");

    // Refresh projects list after creating new project
    await refreshProjects();
  };

  const handleProjectSwitch = async (newProjectName: string) => {
    try {
      // Get all projects first to ensure we have the latest data
      const allProjects = await window.electronAPI.getProjects();
      const project = allProjects.find((p: any) => p.name === newProjectName);

      // Defensive check: ensure project exists
      if (!project) {
        console.error(`Project "${newProjectName}" not found in projects list`);
        alert(`Project "${newProjectName}" not found. Please try again.`);
        return;
      }

      // Update current project in settings
      await window.electronAPI.saveSettings({
        auth_method: "api_key",
        current_project: newProjectName,
        api_key: apiKey,
      });

      // Update project last_accessed time
      await window.electronAPI.updateProject({
        ...project,
        last_accessed: Date.now(),
      });

      // Update UI state immediately with new project data
      setProjectName(newProjectName);
      setProjectRoot(project.path);

      // Load raw text (handle null case)
      const raw = await window.electronAPI.getRaw(newProjectName);
      setRawText(raw || "");

      // Load notes (handle null case for projects with no tasks)
      const notes = await window.electronAPI.getNotes(newProjectName);
      if (notes && notes.tasks && notes.tasks.length > 0) {
        // Project has existing tasks
        setTasks(notes.tasks);
        setLastFormattedRaw(notes.last_formatted_raw || "");
        setView("tasks");
      } else {
        // Project has no tasks yet - this is a valid state
        setTasks([]);
        setLastFormattedRaw("");
        setView("raw");
      }

      // Refresh projects list to update sort order
      // Use a small delay to prevent UI state conflicts during dropdown interaction
      setTimeout(() => {
        refreshProjects();
      }, 100);
    } catch (error) {
      console.error("Failed to switch project:", error);
      alert(
        `Failed to switch project: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleNewProject = () => {
    // Reset to setup view
    setIsSetupComplete(false);
    setProjectName("");
    setProjectRoot("");
    setRawText("");
    setTasks([]);
    setLastFormattedRaw("");
    setView("setup");
  };

  const handleCancelSetup = async () => {
    // Return to the previous project (most recently accessed)
    try {
      const allProjects = await window.electronAPI.getProjects();
      if (allProjects.length > 0) {
        // Find the most recently accessed project
        const sorted = allProjects.sort(
          (a, b) => b.last_accessed - a.last_accessed
        );
        const lastProject = sorted[0];

        // Switch back to that project
        setIsSetupComplete(true);
        await handleProjectSwitch(lastProject.name);
      }
    } catch (error) {
      console.error("Failed to cancel setup:", error);
    }
  };

  const handleDeleteProject = async (projectToDelete: string) => {
    try {
      // Delete the project
      await window.electronAPI.deleteProject(projectToDelete);

      // Refresh projects list after deletion
      await refreshProjects();

      // If we deleted the current project, handle switching
      if (projectToDelete === projectName) {
        // Get remaining projects
        const remainingProjects = await window.electronAPI.getProjects();

        if (remainingProjects.length === 0) {
          // No projects left, go to setup
          handleNewProject();
        } else {
          // Switch to the most recently accessed project
          const sorted = remainingProjects.sort(
            (a, b) => b.last_accessed - a.last_accessed
          );
          await handleProjectSwitch(sorted[0].name);
        }
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert(`Failed to delete project: ${error.message}`);
    }
  };

  const handleOpenInNewWindow = async (projectToOpen: string) => {
    try {
      const result = await window.electronAPI.openProjectWindow(projectToOpen);
      if (!result.success) {
        throw new Error(result.error || 'Failed to open window');
      }
    } catch (error) {
      console.error("Failed to open project in new window:", error);
      alert(`Failed to open project: ${error.message}`);
    }
  };

  const handleCloseWindow = async () => {
    await window.electronAPI.closeWindow();
  };

  const handleFormat = async (rawText: string, contextStr: string) => {
    try {
      // Compute diff: only format what's new or changed
      const currentLines = rawText.split("\n").filter((line) => line.trim());
      const lastLines = lastFormattedRaw
        .split("\n")
        .filter((line) => line.trim());

      // Find new/changed lines (simple set difference)
      const lastLinesSet = new Set(lastLines);
      const newLines = currentLines.filter((line) => !lastLinesSet.has(line));

      // If nothing new, don't call Claude
      if (newLines.length === 0) {
        alert("No new changes to format");
        return;
      }

      const diffText = newLines.join("\n");

      // Format only the diff
      const result = await window.electronAPI.formatWithClaude(
        diffText,
        contextStr
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to format");
      }

      const response: ClaudeFormatResponse = result.data;

      // Convert Claude response to TaskNode format
      const newTasks: TaskNode[] = [];

      for (const section of response.sections) {
        for (const task of section.tasks) {
          newTasks.push({
            id: uuidv4(),
            text: task.text,
            checked: false,
            indent: 0,
            children: [],
            metadata: {
              priority: section.priority as
                | "critical"
                | "performance"
                | "feature",
              blocked_by: task.blocked_by,
              depends_on: task.depends_on,
              related_to: task.related_to,
              notes: task.notes, // Now passed as array directly
              deadline: task.deadline,
              effort_estimate: task.effort_estimate,
              tags: task.tags,
              formatted: true, // Task has been analyzed by Claude
            },
          });
        }
      }

      // APPEND new tasks to existing tasks
      const updatedTasks = [...tasks, ...newTasks];
      setTasks(updatedTasks);

      // Update last formatted raw text
      setLastFormattedRaw(rawText);

      // Clear the raw text input since it's now been formatted
      setRawText("");

      // Save notes to storage
      const notesFile: NotesFile = {
        version: "1.0",
        project_path: projectRoot,
        last_modified: Date.now(),
        tasks: updatedTasks,
        last_formatted_raw: rawText,
      };

      await window.electronAPI.saveNotes(projectName, notesFile);

      // Clear the raw.txt file to reflect that text has been formatted
      await window.electronAPI.saveRaw(projectName, "");

      setView("tasks");
    } catch (error) {
      console.error("Format error:", error);
      alert(`Failed to format: ${error.message}`);
    }
  };

  const handleTaskUpdate = async (updatedTasks: TaskNode[]) => {
    setTasks(updatedTasks);

    // Save to storage
    const notesFile: NotesFile = {
      version: "1.0",
      project_path: projectRoot,
      last_modified: Date.now(),
      tasks: updatedTasks,
      last_formatted_raw: lastFormattedRaw,
    };

    await window.electronAPI.saveNotes(projectName, notesFile);
  };

  const toggleView = () => {
    setView(view === "raw" ? "tasks" : "raw");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="text-[var(--text-dim)]">Loading...</div>
      </div>
    );
  }

  if (!isSetupComplete) {
    return (
      <Setup
        onComplete={handleSetupComplete}
        existingApiKey={apiKey}
        onCancel={apiKey ? handleCancelSetup : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Header - Draggable region */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 drag-region">
        <div className="flex items-center gap-6 no-drag">
          <h1 className="text-sm font-mono font-bold tracking-wider uppercase text-[var(--text-primary)]">
            OSCRIBBLE
          </h1>
          <ProjectSwitcher
            projects={projects}
            currentProject={projectName}
            onSwitch={handleProjectSwitch}
            onNewProject={handleNewProject}
            onDelete={handleDeleteProject}
            onOpenInNewWindow={handleOpenInNewWindow}
          />
        </div>
        <div className="flex items-center gap-3 no-drag">
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-2 text-lg leading-none text-[var(--text-primary)] border border-white/10 hover:border-[#FF4D00] hover:text-[#FF4D00] transition-none"
            title="Settings"
          >
            ⚙
          </button>
          {/* Only show toggle button if there are tasks to view or if currently viewing tasks */}
          {(tasks.length > 0 || view === "tasks") && (
            <button
              onClick={toggleView}
              className="px-4 py-2 text-xs leading-none font-mono uppercase tracking-wider border border-white/20 text-[var(--text-primary)] hover:border-[#FF4D00] hover:text-[#FF4D00] transition-none"
            >
              {view === "raw" ? "View Tasks" : "Edit Raw"}
            </button>
          )}
          <button
            onClick={handleCloseWindow}
            className="px-3 py-2 text-lg leading-none text-[var(--text-dim)] border border-white/10 hover:border-red-400 hover:text-red-400 transition-none"
            title="Close Window (Cmd+W)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {view === "raw" && (
          <RawInput
            initialValue={rawText}
            projectName={projectName}
            projectRoot={projectRoot}
            onFormat={handleFormat}
          />
        )}
        {view === "tasks" && (
          <TaskTree tasks={tasks} onUpdate={handleTaskUpdate} projectRoot={projectRoot} />
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          currentApiKey={apiKey}
          onSave={(newApiKey) => {
            setApiKey(newApiKey);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Quick Switcher Modal */}
      <QuickSwitcher
        projects={projects}
        currentProject={projectName}
        isOpen={showQuickSwitcher}
        onClose={() => setShowQuickSwitcher(false)}
        onSwitch={handleProjectSwitch}
        onOpenInNewWindow={handleOpenInNewWindow}
      />
    </div>
  );
}

export default App;

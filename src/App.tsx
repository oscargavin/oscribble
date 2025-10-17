import React, { useState, useEffect } from "react";
import {
  Mic,
  Loader2,
  FileText,
  ListTodo,
  Circle,
  Check,
  AlertCircle,
  Ban,
  List,
  Network,
} from "lucide-react";
import { Setup } from "./components/Setup";
import { RawInput } from "./components/RawInput";
import { TaskTree } from "./components/TaskTree";
import { TaskMapView } from "./components/TaskMapView";
import { Settings } from "./components/Settings";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { QuickSwitcher } from "./components/QuickSwitcher";
import {
  TaskNode,
  NotesFile,
  ClaudeFormatResponse,
  ProjectType,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import { useProjects } from "./hooks/useProjects";
import { useVoiceRecording } from "./hooks/useVoiceRecording";
import {
  mapDependencyReferences,
  ensureTaskTitle,
  normalizeReferences,
} from "./utils/dependencyMapper";
import { getContextStrategy } from "./services/context-strategy";
import { ModelId, getModelColor, DEFAULT_MODEL } from "./config/models";
import logo from "./oscribble-logo.png";
import logoLight from "./oscribble-light.png";

type View = "setup" | "raw" | "tasks" | "map";
type FilterMode = "all" | "unchecked" | "complete" | "high" | "blocked";

function App() {
  const [view, setView] = useState<View>("setup");
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectRoot, setProjectRoot] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("code");
  const [rawText, setRawText] = useState("");
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showContextFiles, setShowContextFiles] = useState<Set<string>>(
    new Set()
  );
  const [apiKey, setApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [userContext, setUserContext] = useState("");
  const [preferredModel, setPreferredModel] = useState<ModelId>(DEFAULT_MODEL);
  const [userLocation, setUserLocation] = useState<{
    city?: string;
    region?: string;
    country?: string;
  }>();
  const [analysisStyle, setAnalysisStyle] = useState<
    "minimal" | "contextual" | "analytical" | "prescriptive"
  >("analytical");
  const [suggestSolutions, setSuggestSolutions] = useState(true);
  const [autoDetectMissingTasks, setAutoDetectMissingTasks] = useState(true);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [lastFormattedRaw, setLastFormattedRaw] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("unchecked");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accentColor, setAccentColor] = useState<string>("var(--accent-orange)");
  const [reduceMotion, setReduceMotion] = useState(false);

  // Voice recording state
  const { isRecording, startRecording, stopRecording } = useVoiceRecording();
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>("");

  // Use the projects hook for centralized project state management
  const { projects, refreshProjects } = useProjects();

  // Create alphabetically sorted projects for persistent keyboard shortcuts
  const alphabeticalProjects = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Check if setup is complete on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Check if project was passed via URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlProject = urlParams.get("project");

        const settings = await window.electronAPI.getSettings();

        // Initialize API services if keys are present (independent of project state)
        if (settings?.api_key) {
          setApiKey(settings.api_key);
          const initResult = await window.electronAPI.initClaude(
            settings.api_key
          );
          if (!initResult.success) {
            console.error("Failed to re-initialize Claude:", initResult.error);
          }
        }

        // Initialize OpenAI if API key is present (graceful degradation if not set)
        if (settings?.openai_api_key) {
          setOpenaiApiKey(settings.openai_api_key);
          const openaiInitResult = await window.electronAPI.initOpenAI(
            settings.openai_api_key
          );
          if (!openaiInitResult.success) {
            console.error(
              "Failed to initialize OpenAI:",
              openaiInitResult.error
            );
          }
        }

        // Load user context if present
        if (settings?.user_context) {
          setUserContext(settings.user_context);
        }

        // Load preferred model if present
        if (settings?.preferred_model) {
          setPreferredModel(settings.preferred_model);
        }

        // Load user location
        if (settings?.user_location) {
          setUserLocation(settings.user_location);
        }

        // Load task generation preferences
        if (settings?.analysis_style) {
          setAnalysisStyle(settings.analysis_style);
        }
        if (settings?.suggest_solutions !== undefined) {
          setSuggestSolutions(settings.suggest_solutions);
        }
        if (settings?.auto_detect_missing_tasks !== undefined) {
          setAutoDetectMissingTasks(settings.auto_detect_missing_tasks);
        }
        if (settings?.enable_web_search !== undefined) {
          setEnableWebSearch(settings.enable_web_search);
        }

        // Load theme preference
        if (settings?.theme) {
          setTheme(settings.theme);
        }

        // Load accent color preference
        if (settings?.accent_color) {
          setAccentColor(settings.accent_color);
        }

        // Load reduce motion preference
        if (settings?.reduce_motion !== undefined) {
          setReduceMotion(settings.reduce_motion);
        }

        // Determine which project to load:
        // 1. URL parameter (for new windows opened for specific projects)
        // 2. settings.current_project (for first window or last used)
        const targetProject = urlProject || settings?.current_project;

        if (targetProject) {
          setIsSetupComplete(true);
          setProjectName(targetProject);

          // Load project data
          const projects = await window.electronAPI.getProjects();
          const project = projects.find((p: any) => p.name === targetProject);
          if (project) {
            setProjectRoot(project.path);
            setProjectType(project.type || "code"); // Load project type
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

  // Apply theme to document element
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
    }
  }, [theme]);

  // Apply accent color to CSS variables
  useEffect(() => {
    const root = document.documentElement;

    // Helper function to convert color to rgba
    const hexToRgba = (color: string, alpha: number): string => {
      // Handle var(--accent-orange) case - use the computed color from CSS
      if (color.startsWith('var(')) {
        const computedColor = getComputedStyle(root).getPropertyValue('--accent-orange').trim();
        return hexToRgba(computedColor, alpha);
      }

      // Parse hex color
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Helper function to lighten a color by mixing with white
    const lightenColor = (color: string, amount: number): string => {
      // Handle var(--accent-orange) case - use the computed color from CSS
      if (color.startsWith('var(')) {
        const computedColor = getComputedStyle(root).getPropertyValue('--accent-orange').trim();
        return lightenColor(computedColor, amount);
      }

      // Parse hex color
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      // Mix with white
      const newR = Math.round(r + (255 - r) * amount);
      const newG = Math.round(g + (255 - g) * amount);
      const newB = Math.round(b + (255 - b) * amount);

      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };

    root.style.setProperty('--accent-orange', accentColor);
    // Also update hover/derived colors based on the accent
    root.style.setProperty('--accent-orange-hover', `${accentColor}cc`); // 80% opacity
    root.style.setProperty('--accent-orange-bg', `${accentColor}1a`); // 10% opacity
    root.style.setProperty('--accent-orange-border', `${accentColor}80`); // 50% opacity

    // Calculate lighter variants for model indicators
    root.style.setProperty('--accent-light', lightenColor(accentColor, 0.40)); // 40% lighter
    root.style.setProperty('--accent-medium', lightenColor(accentColor, 0.20)); // 20% lighter

    // Calculate scrollbar colors
    root.style.setProperty('--scrollbar-thumb', hexToRgba(accentColor, 0.6));
    root.style.setProperty('--scrollbar-thumb-hover', hexToRgba(accentColor, 0.8));
    root.style.setProperty('--scrollbar-thumb-active', hexToRgba(accentColor, 1));
  }, [accentColor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Voice recording: CMD+R to toggle recording (press once to start, again to stop)
      if ((e.metaKey || e.ctrlKey) && e.key === "r" && !e.repeat) {
        e.preventDefault();
        handleVoiceToggle();
      }
      // ESC to cancel recording
      if (e.key === "Escape" && isRecording) {
        e.preventDefault();
        handleVoiceCancel();
      }
      // Quick switcher: Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickSwitcher(true);
      }
      // Settings: Cmd+S or Ctrl+S
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        setShowSettings(true);
      }
      // Close window: Cmd+W or Ctrl+W
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        handleCloseWindow();
      }
      // New window: Cmd+N or Ctrl+N (opens current project in new window)
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        if (projectName) {
          handleOpenInNewWindow(projectName);
        }
      }
      // Project switching: Cmd+1, Cmd+2, Cmd+3, etc. (up to 9, alphabetically)
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const projectIndex = parseInt(e.key, 10) - 1;
        if (
          alphabeticalProjects[projectIndex] &&
          alphabeticalProjects[projectIndex].name !== projectName
        ) {
          handleProjectSwitch(alphabeticalProjects[projectIndex].name);
        }
      }
      // Toggle between raw and tasks view: Cmd+T
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "t" &&
        (tasks.length > 0 || view === "tasks" || view === "map")
      ) {
        e.preventDefault();
        toggleView();
      }
      // Toggle to map view: Cmd+M
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "m" &&
        (tasks.length > 0 || view === "map")
      ) {
        e.preventDefault();
        setView(view === "map" ? "tasks" : "map");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [projectName, isRecording, isProcessing, projects, tasks, view]);

  // File watcher: Auto-reload tasks when external changes detected
  useEffect(() => {
    if (!projectName) return;

    // Start watching this project
    window.electronAPI.startWatchingProject(projectName);

    // Listen for file changes
    const unsubscribe = window.electronAPI.onNotesChanged(
      async (changedProject) => {
        // Only reload if the change is for our current project
        if (changedProject === projectName) {
          console.log("External change detected, reloading tasks...");
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
            console.error("Failed to reload tasks:", error);
          }
        }
      }
    );

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
        openai_api_key: openaiApiKey || undefined,
        user_context: userContext || undefined,
        preferred_model: preferredModel,
        user_location: userLocation,
        analysis_style: analysisStyle,
        suggest_solutions: suggestSolutions,
        auto_detect_missing_tasks: autoDetectMissingTasks,
        enable_web_search: enableWebSearch,
        theme: theme,
        accent_color: accentColor,
        reduce_motion: reduceMotion,
      });

      // Update project last_accessed time
      await window.electronAPI.updateProject({
        ...project,
        last_accessed: Date.now(),
      });

      // Clear tasks FIRST to prevent flash of wrong project's tasks
      setTasks([]);

      // Then update project identity
      setProjectName(newProjectName);
      setProjectRoot(project.path);
      setProjectType(project.type || "code"); // Load project type

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
        throw new Error(result.error || "Failed to open window");
      }
    } catch (error) {
      console.error("Failed to open project in new window:", error);
      alert(`Failed to open project: ${error.message}`);
    }
  };

  const handleCloseWindow = async () => {
    await window.electronAPI.closeWindow();
  };

  const handleVoiceToggle = async () => {
    if (isProcessing) return; // Don't allow toggle while processing

    if (isRecording) {
      // Stop recording and process
      await handleVoiceStop();
    } else {
      // Start recording
      await handleVoiceStart();
    }
  };

  const handleVoiceStart = async () => {
    // Check if OpenAI is configured
    const settings = await window.electronAPI.getSettings();
    if (!settings?.openai_api_key) {
      alert(
        "OpenAI API key required for voice input. Please add it in Settings."
      );
      return;
    }

    await startRecording();
  };

  const handleVoiceStop = async () => {
    // Don't process if not recording
    if (!isRecording) return;

    setIsProcessing(true);
    setVoiceStatus("TRANSCRIBING");
    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        throw new Error("No audio recorded");
      }

      // Convert blob to ArrayBuffer for IPC
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Transcribe with OpenAI
      const transcriptResult =
        await window.electronAPI.transcribeAudio(arrayBuffer);
      if (!transcriptResult.success) {
        throw new Error(transcriptResult.error || "Transcription failed");
      }

      const transcript = transcriptResult.data;

      // Format gathered context for Claude
      let contextString = "";
      let contextFiles: {
        path: string;
        wasGrepped?: boolean;
        matchedKeywords?: string[];
      }[] = [];

      // Always gather context for voice input
      setVoiceStatus("GATHERING");
      // Gather context from transcript (includes @mentions and auto-discovery)
      const contextResult = await window.electronAPI.gatherProjectContext(
        transcript,
        projectRoot
      );

      if (contextResult.success && contextResult.data) {
        const gc = contextResult.data;
        contextString = gc.files
          .map((f) => {
            const header = f.wasGrepped
              ? `--- ${f.path} (grep: ${f.matchedKeywords?.join(", ")}) ---`
              : `--- ${f.path} ---`;
            return `${header}\n${f.content}`;
          })
          .join("\n\n");

        // Extract file metadata for storage with tasks
        contextFiles = gc.files.map((f) => ({
          path: f.path,
          wasGrepped: f.wasGrepped,
          matchedKeywords: f.matchedKeywords,
        }));

        console.log(
          `Context: ${gc.files.length} files, ${gc.totalLines} lines (${gc.cacheHits} cached)`
        );
      }

      // Show SEARCHING state for life admin projects (web search may occur)
      if (projectType === "life_admin") {
        setVoiceStatus("SEARCHING");
        // Small delay to ensure UI updates
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setVoiceStatus("ANALYZING");
      // Format with Claude (with voice input flag)
      await handleFormat(transcript, contextString, true, contextFiles);

      setVoiceStatus("FORMATTING");
    } catch (error) {
      console.error("Voice processing error:", error);
      alert(`Voice processing failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setVoiceStatus("");
    }
  };

  const handleVoiceCancel = async () => {
    if (isRecording) {
      await stopRecording();
      // Don't process the audio, just stop recording
    }
  };

  // Helper function to recursively convert ClaudeTask to TaskNode (including subtasks)
  const convertClaudeTaskToTaskNode = (
    claudeTask: any,
    priority: "high" | "medium" | "low",
    contextFiles?: {
      path: string;
      wasGrepped?: boolean;
      matchedKeywords?: string[];
    }[],
    citations?: { [index: string]: { url: string; title: string } }
  ): TaskNode => {
    const taskTitle = ensureTaskTitle(claudeTask);

    // Recursively convert subtasks if they exist
    let convertedSubtasks: TaskNode[] | undefined;
    if (
      claudeTask.subtasks &&
      Array.isArray(claudeTask.subtasks) &&
      claudeTask.subtasks.length > 0
    ) {
      convertedSubtasks = claudeTask.subtasks.map((subtask: any) =>
        convertClaudeTaskToTaskNode(subtask, priority, contextFiles, citations)
      );
    }

    return {
      id: uuidv4(),
      text: claudeTask.text,
      checked: false,
      indent: 0,
      children: [],
      subtasks: convertedSubtasks,
      metadata: {
        title: taskTitle,
        priority: priority,
        original_priority: priority,
        priority_edited: false,
        blocked_by: claudeTask.blocked_by,
        depends_on: undefined, // Will be mapped later
        related_to: undefined, // Will be mapped later
        notes: claudeTask.notes,
        deadline: claudeTask.deadline,
        effort_estimate: claudeTask.effort_estimate,
        tags: claudeTask.tags,
        formatted: true,
        context_files: contextFiles,
        citations: citations,
      },
    };
  };

  const handleFormat = async (
    rawText: string,
    contextStr: string,
    isVoiceInput: boolean = false,
    contextFiles?: {
      path: string;
      wasGrepped?: boolean;
      matchedKeywords?: string[];
    }[]
  ) => {
    try {
      let textToFormat = rawText;

      // Only apply diff logic for manual text input (not voice)
      if (!isVoiceInput) {
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

        textToFormat = newLines.join("\n");
      }

      // Get appropriate strategy
      const strategy = getContextStrategy(projectType);

      // Gather context if strategy requires it and context not already provided
      let finalContextStr = contextStr;
      let finalContextFiles = contextFiles;

      if (strategy.shouldShowFileTree() && !contextStr) {
        // Gather context using strategy
        const gatheredContext = await strategy.gatherContext(
          textToFormat,
          projectRoot
        );
        finalContextStr = gatheredContext.files
          .map((f) => {
            const header = f.wasGrepped
              ? `--- ${f.path} (grep: ${f.matchedKeywords?.join(", ")}) ---`
              : `--- ${f.path} ---`;
            return `${header}\n${f.content}`;
          })
          .join("\n\n");

        finalContextFiles = gatheredContext.files.map((f) => ({
          path: f.path,
          wasGrepped: f.wasGrepped,
          matchedKeywords: f.matchedKeywords,
        }));
      }

      // Format the text (pass projectType)
      const result = await window.electronAPI.formatWithClaude(
        textToFormat,
        finalContextStr,
        isVoiceInput,
        projectName,
        projectType
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to format");
      }

      const response: ClaudeFormatResponse = result.data;

      // Extract citations if present (from web search)
      const citations = (response as any).citations;

      // Convert Claude response to TaskNode format (including subtasks)
      const newTasks: TaskNode[] = [];

      console.log("🔍 Claude returned sections:", response.sections.length);
      for (const section of response.sections) {
        console.log(`🔍 Section has ${section.tasks.length} tasks`);
        for (const task of section.tasks) {
          console.log(
            `🔍 Task: "${task.text}" with ${task.subtasks?.length || 0} subtasks`
          );
          const priority = section.priority as "high" | "medium" | "low";
          newTasks.push(
            convertClaudeTaskToTaskNode(
              task,
              priority,
              finalContextFiles,
              citations
            )
          );
        }
      }
      console.log(`🔍 Total tasks created: ${newTasks.length}`);

      // Second pass: Map dependency references to UUIDs
      let taskIndex = 0;
      for (const section of response.sections) {
        for (const task of section.tasks) {
          const currentTask = newTasks[taskIndex];

          // Map depends_on references
          if (task.depends_on) {
            const normalized = normalizeReferences(task.depends_on);
            currentTask.metadata!.depends_on = mapDependencyReferences(
              normalized,
              newTasks,
              tasks
            );
          }

          // Map related_to references
          if (task.related_to) {
            const normalized = normalizeReferences(task.related_to);
            currentTask.metadata!.related_to = mapDependencyReferences(
              normalized,
              newTasks,
              tasks
            );
          }

          taskIndex++;
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

      // Switch to tasks view with unchecked filter to show newly generated tasks
      setView("tasks");
      setFilterMode("unchecked");
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

  const cycleFilterMode = () => {
    const modes: FilterMode[] = [
      "unchecked",
      "all",
      "complete",
      "high",
      "blocked",
    ];
    const currentIndex = modes.indexOf(filterMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setFilterMode(modes[nextIndex]);
  };

  const getFilterIcon = () => {
    switch (filterMode) {
      case "all":
        return <List size={16} />;
      case "unchecked":
        return <Circle size={16} />;
      case "complete":
        return <Check size={16} />;
      case "high":
        return <AlertCircle size={16} />;
      case "blocked":
        return <Ban size={16} />;
    }
  };

  const getFilterTitle = () => {
    switch (filterMode) {
      case "unchecked":
        return "Incomplete tasks (1)";
      case "all":
        return "All tasks (2)";
      case "complete":
        return "Complete tasks (3)";
      case "high":
        return "High priority tasks (4)";
      case "blocked":
        return "Blocked tasks (5)";
    }
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
          <a
            href="https://oscr.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="w-[56px] h-[28px] flex items-center justify-center border border-[var(--border-accent)] text-[var(--text-primary)] font-mono text-[10px] tracking-wider uppercase opacity-60 hover:opacity-100 hover:border-[var(--accent-orange)] transition-all"
          >
            OSCR
          </a>
          <ProjectSwitcher
            projects={projects}
            currentProject={projectName}
            onSwitch={handleProjectSwitch}
            onNewProject={handleNewProject}
            onDelete={handleDeleteProject}
            onOpenInNewWindow={handleOpenInNewWindow}
          />
          {voiceStatus && (
            <span className="text-xs text-[var(--text-secondary)] font-mono uppercase">
              {voiceStatus}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 no-drag">
          {/* Model Indicator */}
          <div
            className="w-[28px] h-[28px] flex items-center justify-center border text-[10px] font-mono transition-colors duration-150 opacity-60 hover:opacity-100"
            style={{
              borderColor: getModelColor(preferredModel),
              color: getModelColor(preferredModel),
            }}
            title={`Claude ${preferredModel.toUpperCase()}`}
          >
            {preferredModel.charAt(0).toUpperCase()}
          </div>
          {/* Filter Button - only show when in tasks view */}
          {view === "tasks" && (
            <button
              onClick={cycleFilterMode}
              className="w-[28px] h-[28px] flex items-center justify-center border border-[var(--border-accent)] text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] transition-colors duration-200"
              title={getFilterTitle()}
            >
              {getFilterIcon()}
            </button>
          )}
          {/* Toggle button - placed after filter to prevent layout shifts */}
          {(tasks.length > 0 || view === "tasks" || view === "map") && (
            <>
              <button
                onClick={toggleView}
                className="h-[28px] w-[28px] flex items-center justify-center border border-[var(--border-accent)] text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] transition-colors duration-200"
                title={
                  view === "raw"
                    ? "Switch to tasks view (Cmd+T)"
                    : "Switch to raw view (Cmd+T)"
                }
              >
                {view === "raw" ? (
                  <ListTodo size={16} />
                ) : (
                  <FileText size={16} />
                )}
              </button>
              <button
                onClick={() => setView(view === "map" ? "tasks" : "map")}
                className={`h-[28px] w-[28px] flex items-center justify-center border transition-colors duration-200 ${
                  view === "map"
                    ? "border-[var(--accent-orange)] text-[var(--accent-orange)]"
                    : "border-[var(--border-accent)] text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)]"
                }`}
                title={
                  view === "map"
                    ? "Switch to list view (Cmd+M)"
                    : "Switch to map view (Cmd+M)"
                }
              >
                <Network size={16} />
              </button>
            </>
          )}
          {/* Voice Recording Button */}
          <button
            onClick={handleVoiceToggle}
            disabled={isProcessing}
            className={`w-[28px] h-[28px] flex items-center justify-center border transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
              isRecording
                ? "bg-red-600 border-red-600 text-white animate-pulse"
                : isProcessing
                  ? "bg-[var(--border-subtle)] border-[var(--border-accent)] text-[var(--text-secondary)]"
                  : "border-[var(--border-accent)] text-[var(--text-secondary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)]"
            }`}
            title={
              isRecording
                ? "Stop recording (Cmd+R or ESC)"
                : "Start recording (Cmd+R)"
            }
          >
            {isProcessing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Mic size={16} />
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-[28px] h-[28px] flex items-center justify-center text-sm leading-none text-[var(--text-secondary)] border border-[var(--border-accent)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] transition-colors duration-200"
            title="Settings (CMD+S)"
          >
            ⚙
          </button>
          <button
            onClick={handleCloseWindow}
            className="w-[28px] h-[28px] flex items-center justify-center text-sm leading-none text-[var(--text-secondary)] border border-[var(--border-accent)] hover:border-red-600 hover:text-red-600 transition-colors duration-200"
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
            shouldShowFileTree={getContextStrategy(
              projectType
            ).shouldShowFileTree()}
            onFormat={handleFormat}
          />
        )}
        {view === "tasks" && (
          <TaskTree
            tasks={tasks}
            onUpdate={handleTaskUpdate}
            projectRoot={projectRoot}
            projectName={projectName}
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            showContextFiles={showContextFiles}
            setShowContextFiles={setShowContextFiles}
            hasVoice={!!openaiApiKey}
            shouldShowFileTree={getContextStrategy(
              projectType
            ).shouldShowFileTree()}
            reduceMotion={reduceMotion}
          />
        )}
        {view === "map" && (
          <TaskMapView
            tasks={tasks}
            onUpdate={handleTaskUpdate}
            projectRoot={projectRoot}
            projectName={projectName}
          />
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          currentApiKey={apiKey}
          currentOpenAIApiKey={openaiApiKey}
          currentUserContext={userContext}
          currentModel={preferredModel}
          currentLocation={userLocation}
          currentAnalysisStyle={analysisStyle}
          currentSuggestSolutions={suggestSolutions}
          currentAutoDetectMissingTasks={autoDetectMissingTasks}
          currentEnableWebSearch={enableWebSearch}
          currentTheme={theme}
          currentAccentColor={accentColor}
          currentReduceMotion={reduceMotion}
          onSave={(
            newApiKey,
            newOpenaiApiKey,
            newUserContext,
            newModel,
            newLocation,
            newAnalysisStyle,
            newSuggestSolutions,
            newAutoDetectMissingTasks,
            newEnableWebSearch,
            newTheme,
            newAccentColor,
            newReduceMotion
          ) => {
            setApiKey(newApiKey);
            if (newOpenaiApiKey) {
              setOpenaiApiKey(newOpenaiApiKey);
            }
            if (newUserContext !== undefined) {
              setUserContext(newUserContext);
            }
            if (newModel) {
              setPreferredModel(newModel);
            }
            if (newLocation !== undefined) {
              setUserLocation(newLocation);
            }
            if (newAnalysisStyle !== undefined) {
              setAnalysisStyle(newAnalysisStyle);
            }
            if (newSuggestSolutions !== undefined) {
              setSuggestSolutions(newSuggestSolutions);
            }
            if (newAutoDetectMissingTasks !== undefined) {
              setAutoDetectMissingTasks(newAutoDetectMissingTasks);
            }
            if (newEnableWebSearch !== undefined) {
              setEnableWebSearch(newEnableWebSearch);
            }
            if (newTheme !== undefined) {
              setTheme(newTheme);
            }
            if (newAccentColor !== undefined) {
              setAccentColor(newAccentColor);
            }
            if (newReduceMotion !== undefined) {
              setReduceMotion(newReduceMotion);
            }
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

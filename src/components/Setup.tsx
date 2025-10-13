import React, { useState, useEffect, useRef } from 'react';
import { DirectoryAutocomplete } from './DirectoryAutocomplete';

interface SetupProps {
  onComplete: (apiKey: string, projectPath: string) => void;
  existingApiKey?: string; // Pre-fill API key if already exists
  onCancel?: () => void; // Optional cancel handler (only shown when projects exist)
}

export const Setup: React.FC<SetupProps> = ({ onComplete, existingApiKey, onCancel }) => {
  const [apiKey, setApiKey] = useState(existingApiKey || '');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [directorySuggestions, setDirectorySuggestions] = useState<string[]>([]);
  const [showDirectoryAutocomplete, setShowDirectoryAutocomplete] = useState(false);
  const [loadingDirectories, setLoadingDirectories] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Scroll input to the end when path changes
  useEffect(() => {
    if (pathInputRef.current) {
      // Scroll to the end to show the most relevant part (directory name)
      pathInputRef.current.scrollLeft = pathInputRef.current.scrollWidth;
    }
  }, [projectPath]);

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showDirectoryAutocomplete &&
        pathInputRef.current &&
        autocompleteRef.current &&
        !pathInputRef.current.contains(event.target as Node) &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowDirectoryAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDirectoryAutocomplete]);

  // Debounced directory search (200ms)
  useEffect(() => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Only search if we have a path
    if (!projectPath || projectPath.length === 0) {
      setShowDirectoryAutocomplete(false);
      setLoadingDirectories(false);
      return;
    }

    // Show loading state
    setLoadingDirectories(true);

    // Debounce the search
    debounceTimer.current = setTimeout(async () => {
      try {
        const result = await window.electronAPI.getDirectorySuggestions(projectPath);
        if (result.success && result.directories.length > 0) {
          setDirectorySuggestions(result.directories);
          setShowDirectoryAutocomplete(true);
        } else {
          setDirectorySuggestions([]);
          setShowDirectoryAutocomplete(false);
        }
      } catch (error) {
        console.error('Failed to get directory suggestions:', error);
        setShowDirectoryAutocomplete(false);
      } finally {
        setLoadingDirectories(false);
      }
    }, 200);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [projectPath]);

  const handleDirectorySelect = (directory: string) => {
    // Add trailing slash to indicate we're "inside" this directory
    const pathWithSlash = directory.endsWith('/') ? directory : directory + '/';
    setProjectPath(pathWithSlash);
    setShowDirectoryAutocomplete(false);
    // The useEffect will trigger after 200ms to show subdirectories
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Initialize Claude (only during initial onboarding when no existing API key)
      if (!existingApiKey) {
        const result = await window.electronAPI.initClaude(apiKey);
        if (!result.success) {
          throw new Error(result.error || 'Failed to initialize Claude');
        }

        // Save settings with API keys during initial onboarding
        await window.electronAPI.saveSettings({
          auth_method: 'api_key',
          current_project: projectName,
          api_key: apiKey, // Persist Anthropic API key
          openai_api_key: openaiApiKey, // Persist OpenAI API key
        });
      } else {
        // For new projects, just update the current project
        await window.electronAPI.saveSettings({
          auth_method: 'api_key',
          current_project: projectName,
          api_key: existingApiKey, // Keep existing Anthropic API key
          // OpenAI key already exists in settings
        });
      }

      // Add project
      await window.electronAPI.addProject({
        name: projectName,
        path: projectPath,
        created: Date.now(),
        last_accessed: Date.now(),
      });

      onComplete(apiKey, projectPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = async () => {
    try {
      // Use current path as starting point, or undefined for default (home directory)
      const result = await window.electronAPI.selectDirectory(projectPath || undefined);

      if (result.success && result.path) {
        setProjectPath(result.path);

        // Auto-fill project name from directory name if not already set
        if (!projectName) {
          const dirName = result.path.split('/').filter(Boolean).pop();
          if (dirName) {
            setProjectName(dirName);
          }
        }

        // Close autocomplete if open
        setShowDirectoryAutocomplete(false);
      }
      // If canceled, do nothing (user clicked cancel button)
    } catch (error) {
      console.error('Failed to select directory:', error);
      setError('Failed to open directory picker');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-black drag-region">
      <div className="w-full max-w-md p-8 no-drag relative border border-[var(--text-dim)]">
        {/* Close button - only show if onCancel is provided (projects exist) */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-[#FF4D00] hover:opacity-100 opacity-70 transition-opacity text-lg"
            title="Cancel and return"
            aria-label="Close setup"
          >
            ×
          </button>
        )}

        <h1 className="text-sm font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider">
          {existingApiKey ? 'New Project' : 'Welcome to Oscribble'}
        </h1>
        <p className="text-xs text-[var(--text-dim)] mb-8">
          {existingApiKey
            ? 'create a new project to organize your tasks.'
            : 'transform your task notes into structured, actionable lists with ai.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Only show API key inputs during initial onboarding */}
          {!existingApiKey && (
            <>
              <div>
                <label
                  htmlFor="apiKey"
                  className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
                >
                  Anthropic API Key
                </label>
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  required
                  className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
                />
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  get your api key from{' '}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FF4D00] hover:opacity-70"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>

              <div>
                <label
                  htmlFor="openaiApiKey"
                  className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
                >
                  OpenAI API Key
                </label>
                <input
                  id="openaiApiKey"
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  required
                  className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
                />
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  for whisper transcription - get from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FF4D00] hover:opacity-70"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="projectName"
              className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
            >
              Project Name
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-project"
              required
              className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm"
            />
          </div>

          <div className="relative">
            <label
              htmlFor="projectPath"
              className="block text-[10px] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wider"
            >
              Project Root Path
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative" ref={autocompleteRef}>
                <input
                  ref={pathInputRef}
                  id="projectPath"
                  type="text"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  onFocus={() => {
                    if (projectPath && directorySuggestions.length > 0) {
                      setShowDirectoryAutocomplete(true);
                    }
                  }}
                  placeholder="/Users/you/projects/my-project"
                  required
                  className={`w-full px-3 py-2 bg-black text-[var(--text-primary)] border focus:outline-none text-sm font-mono ${
                    loadingDirectories
                      ? 'loading-border'
                      : 'border-[var(--text-dim)] focus:border-[#FF4D00]'
                  }`}
                />
                {showDirectoryAutocomplete && (
                  <DirectoryAutocomplete
                    directories={directorySuggestions}
                    onSelect={handleDirectorySelect}
                    onClose={() => setShowDirectoryAutocomplete(false)}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={handleBrowse}
                className="px-4 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] hover:border-[var(--text-primary)] transition-colors text-xs uppercase tracking-wider"
              >
                Browse
              </button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-[var(--text-dim)]">
                the root directory of your project for @file mentions
              </p>
              {loadingDirectories && (
                <span className="text-xs text-[#FF4D00] shimmer flex items-center gap-1">
                  <span>•</span>
                  <span>searching</span>
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#FF4D00]/10 border border-[#FF4D00] text-xs text-[#FF4D00]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-[#FF4D00] text-black border border-[#FF4D00] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity font-bold text-xs uppercase tracking-wider"
          >
            {loading ? (existingApiKey ? 'Creating...' : 'Setting up...') : existingApiKey ? 'Create Project' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Clipboard, Wrench } from 'lucide-react';
import { ProjectSettings } from '../types';

interface QuickSwitcherProps {
  currentProject: string;
  isOpen: boolean;
  onClose: () => void;
  onSwitch: (projectName: string) => void;
  onOpenInNewWindow?: (projectName: string) => void;
  projects: ProjectSettings[];
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  currentProject,
  isOpen,
  onClose,
  onSwitch,
  onOpenInNewWindow,
  projects,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigationScheduledRef = useRef<number | null>(null);

  // Create alphabetical projects list for hotkey mapping
  const alphabeticalProjects = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Get hotkey number for a project (1-9 based on alphabetical order)
  const getHotkeyNumber = (projectName: string): number | null => {
    const index = alphabeticalProjects.findIndex(p => p.name === projectName);
    return index >= 0 && index < 9 ? index + 1 : null;
  };

  // Reset state and focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);

      // Focus input after a tick
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Filter and sort projects: current first, then alphabetically
  const filteredProjects = projects
    .filter((project) =>
      project.name.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      if (a.name === currentProject) return -1;
      if (b.name === currentProject) return 1;
      return a.name.localeCompare(b.name);
    });

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();

        // Cancel any pending navigation
        if (navigationScheduledRef.current !== null) {
          cancelAnimationFrame(navigationScheduledRef.current);
        }

        // Schedule navigation for next frame to throttle rapid keypresses
        navigationScheduledRef.current = requestAnimationFrame(() => {
          setSelectedIndex((prev) =>
            prev < filteredProjects.length - 1 ? prev + 1 : prev
          );
          navigationScheduledRef.current = null;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();

        // Cancel any pending navigation
        if (navigationScheduledRef.current !== null) {
          cancelAnimationFrame(navigationScheduledRef.current);
        }

        // Schedule navigation for next frame to throttle rapid keypresses
        navigationScheduledRef.current = requestAnimationFrame(() => {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          navigationScheduledRef.current = null;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredProjects[selectedIndex]) {
          // Shift+Enter opens in new window
          if (e.shiftKey && onOpenInNewWindow) {
            onOpenInNewWindow(filteredProjects[selectedIndex].name);
            onClose();
          } else {
            handleSelect(filteredProjects[selectedIndex].name);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredProjects, selectedIndex]);

  const handleSelect = (projectName: string) => {
    if (projectName !== currentProject) {
      onSwitch(projectName);
    }
    onClose();
  };

  const handleOpenInWindow = (e: React.MouseEvent, projectName: string) => {
    e.stopPropagation();
    if (onOpenInNewWindow) {
      onOpenInNewWindow(projectName);
    }
    onClose();
  };

  const formatLastAccessed = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/80">
      <div className="w-full max-w-xl bg-[var(--bg-primary)] border border-[var(--text-primary)]">
        {/* Search input */}
        <div className="p-3 border-b border-[var(--text-dim)]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="switch project..."
            className="w-full px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-orange)] text-sm font-mono"
          />
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filteredProjects.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-dim)] text-xs">
              no projects found
            </div>
          ) : (
            filteredProjects.map((project, index) => {
              const hotkeyNumber = getHotkeyNumber(project.name);
              return (
              <div
                key={project.name}
                onClick={() => handleSelect(project.name)}
                className={`group relative w-full px-3 py-2.5 text-left text-xs cursor-pointer transition-all flex items-center justify-between border-b border-[var(--text-dim)]/30 last:border-0 ${
                  index === selectedIndex
                    ? 'bg-[var(--accent-orange)]/10 text-[var(--text-primary)] border-l-2 border-l-[var(--accent-orange)] pl-[10px]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {hotkeyNumber && (
                    <span className="text-[10px] text-[var(--text-dim)] font-mono w-4 text-center flex-shrink-0">
                      {hotkeyNumber}
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[var(--text-dim)]">
                    {project.type === 'life_admin' ? <Clipboard size={14} /> : <Wrench size={14} />}
                  </span>
                  <span className="font-mono truncate">{project.name}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onOpenInNewWindow && project.name !== currentProject && (
                    <button
                      onClick={(e) => handleOpenInWindow(e, project.name)}
                      className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded hover:bg-[var(--accent-orange)]/10 text-[var(--text-dim)] hover:text-[var(--accent-orange)] z-10"
                      title="Open in new window (Shift+Enter)"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                  {project.name === currentProject ? (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--accent-orange)] ml-1">current</span>
                  ) : (
                    <span className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider ml-1">
                      {formatLastAccessed(project.last_accessed)}
                    </span>
                  )}
                </div>
              </div>
            );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--text-dim)] bg-[var(--bg-primary)] text-[10px] text-[var(--text-dim)] flex items-center justify-between uppercase tracking-wider">
          <span>↑↓ navigate • enter select • cmd+# switch{onOpenInNewWindow ? ' • shift+enter new window' : ''}</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
};

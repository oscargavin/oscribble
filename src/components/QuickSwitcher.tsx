import React, { useState, useEffect, useRef } from 'react';
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

  // Reset state and focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);

      // Focus input after a tick
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Filter projects based on query
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(query.toLowerCase())
  );

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
        setSelectedIndex((prev) =>
          prev < filteredProjects.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredProjects[selectedIndex]) {
          // Shift+Enter opens in new window
          if (e.shiftKey && onOpenInNewWindow) {
            handleOpenInWindow(filteredProjects[selectedIndex].name);
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

  const handleOpenInWindow = (projectName: string) => {
    if (onOpenInNewWindow) {
      onOpenInNewWindow(projectName);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/80">
      <div className="w-full max-w-xl bg-black border border-[var(--text-primary)]">
        {/* Search input */}
        <div className="p-3 border-b border-[var(--text-dim)]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="switch project..."
            className="w-full px-3 py-2 bg-black text-[var(--text-primary)] border border-[var(--text-dim)] focus:outline-none focus:border-[#FF4D00] text-sm font-mono"
          />
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filteredProjects.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-dim)] text-xs">
              no projects found
            </div>
          ) : (
            filteredProjects.map((project, index) => (
              <button
                key={project.name}
                onClick={() => handleSelect(project.name)}
                className={`w-full px-4 py-3 text-left text-sm font-mono transition-opacity flex items-center justify-between border-b border-[var(--text-dim)]/30 last:border-0 ${
                  index === selectedIndex
                    ? 'bg-[#FF4D00] text-black'
                    : 'text-[var(--text-primary)] hover:opacity-70'
                }`}
              >
                <span className="flex-1 truncate">{project.name}</span>
                {project.name === currentProject && (
                  <span className="text-xs ml-2 opacity-70 uppercase tracking-wider">current</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--text-dim)] bg-black text-[10px] text-[var(--text-dim)] flex items-center justify-between uppercase tracking-wider">
          <span>↑↓ navigate • enter select{onOpenInNewWindow ? ' • shift+enter new window' : ''}</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
};

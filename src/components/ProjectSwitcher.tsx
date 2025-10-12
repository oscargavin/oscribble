import React, { useState, useEffect, useRef } from 'react';
import { ProjectSettings } from '../types';

interface ProjectSwitcherProps {
  projects: ProjectSettings[];
  currentProject: string;
  onSwitch: (projectName: string) => void;
  onNewProject: () => void;
  onDelete?: (projectName: string) => void;
  onOpenInNewWindow?: (projectName: string) => void;
}

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  projects,
  currentProject,
  onSwitch,
  onNewProject,
  onDelete,
  onOpenInNewWindow,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

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

  const handleSelect = (projectName: string) => {
    // Close dropdown immediately to prevent UI conflicts
    setIsOpen(false);

    // Only switch if it's a different project
    if (projectName !== currentProject) {
      // Use setTimeout to ensure dropdown closes before switch begins
      setTimeout(() => {
        onSwitch(projectName);
      }, 50);
    }
  };

  const handleDelete = (e: React.MouseEvent, projectName: string) => {
    e.stopPropagation();
    onDelete?.(projectName);
  };

  const handleOpenInNewWindow = (e: React.MouseEvent, projectName: string) => {
    e.stopPropagation();
    onOpenInNewWindow?.(projectName);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--text-primary)] hover:opacity-70 transition-opacity border border-[var(--text-dim)]"
      >
        <span className="font-mono">{currentProject}</span>
        <span className="text-[var(--text-dim)]">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-black border border-[var(--text-primary)] z-50 max-h-80 overflow-y-auto no-drag">
          {projects && projects.length > 0 ? projects.map((project) => (
            <div
              key={project.name}
              className={`relative group flex items-center justify-between px-3 py-2 text-xs transition-all cursor-pointer border-b border-[var(--text-dim)]/30 last:border-0 ${
                project.name === currentProject
                  ? 'bg-[#0A0A0A] text-[var(--text-primary)] border-l-2 border-l-[#FF4D00] pl-[10px]'
                  : 'text-[var(--text-primary)] hover:bg-[#0A0A0A]'
              }`}
              onClick={() => handleSelect(project.name)}
            >
              <span className="flex-1 font-mono truncate pr-2">{project.name}</span>
              <div className="flex items-center gap-2">
                {onOpenInNewWindow && project.name !== currentProject && (
                  <button
                    onClick={(e) => handleOpenInNewWindow(e, project.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#FF4D00] hover:opacity-70 z-10"
                    title="Open in new window"
                  >
                    ⧉
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => handleDelete(e, project.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#FF4D00] hover:opacity-70 z-10"
                    title="Delete project"
                  >
                    🗑
                  </button>
                )}
                <span className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider">
                  {formatLastAccessed(project.last_accessed)}
                </span>
              </div>
            </div>
          )) : (
            <div className="px-3 py-2 text-xs text-[var(--text-dim)] text-center">
              no projects found
            </div>
          )}

          <div className="border-t border-[var(--text-dim)] mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onNewProject();
              }}
              className="w-full px-3 py-2 text-left text-xs text-[#FF4D00] hover:opacity-70 transition-opacity uppercase tracking-wider"
            >
              + New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

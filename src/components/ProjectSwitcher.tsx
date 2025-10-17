import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Trash2, Plus, Clipboard, Wrench } from 'lucide-react';
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

  // Sort projects: current first, then alphabetically
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.name === currentProject) return -1;
    if (b.name === currentProject) return 1;
    return a.name.localeCompare(b.name);
  });

  // Create alphabetical projects list for hotkey mapping
  const alphabeticalProjects = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Get hotkey number for a project (1-9 based on alphabetical order)
  const getHotkeyNumber = (projectName: string): number | null => {
    const index = alphabeticalProjects.findIndex(p => p.name === projectName);
    return index >= 0 && index < 9 ? index + 1 : null;
  };

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
        className="h-[28px] flex items-center gap-2 px-3 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors border border-[var(--text-dim)] hover:border-[var(--accent-orange)]"
      >
        <span className="font-mono">{currentProject}</span>
        {isOpen ? (
          <ChevronUp size={14} className="text-[var(--text-dim)]" />
        ) : (
          <ChevronDown size={14} className="text-[var(--text-dim)]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-[var(--bg-primary)] border border-[var(--text-primary)] z-[100] max-h-80 overflow-y-auto no-drag">
          {sortedProjects && sortedProjects.length > 0 ? sortedProjects.map((project) => {
            const hotkeyNumber = getHotkeyNumber(project.name);
            return (
            <div
              key={project.name}
              className={`relative group flex items-center justify-between px-3 py-2.5 text-xs transition-all cursor-pointer border-b border-[var(--text-dim)]/30 last:border-0 ${
                project.name === currentProject
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-l-2 border-l-[var(--accent-orange)] pl-[10px]'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
              onClick={() => handleSelect(project.name)}
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
                    onClick={(e) => handleOpenInNewWindow(e, project.name)}
                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded hover:bg-[var(--accent-orange)]/10 text-[var(--text-dim)] hover:text-[var(--accent-orange)] z-10"
                    title="Open in new window"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => handleDelete(e, project.name)}
                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded hover:bg-red-600/10 text-[var(--text-dim)] hover:text-red-600 z-10"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <span className="text-[var(--text-dim)] text-[10px] uppercase tracking-wider ml-1">
                  {formatLastAccessed(project.last_accessed)}
                </span>
              </div>
            </div>
          );
          }) : (
            <div className="px-3 py-2 text-xs text-[var(--text-dim)] text-center">
              no projects found
            </div>
          )}

          <div className="border-t border-[var(--text-dim)]">
            <button
              onClick={() => {
                setIsOpen(false);
                onNewProject();
              }}
              className="w-full px-3 py-2.5 text-left text-xs text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/10 transition-colors uppercase tracking-wider flex items-center gap-2"
            >
              <Plus size={14} />
              <span>New Project</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

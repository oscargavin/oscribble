import React, { useEffect, useState, useRef } from 'react';

interface DirectoryAutocompleteProps {
  directories: string[];
  onSelect: (directory: string) => void;
  onClose: () => void;
}

export const DirectoryAutocomplete: React.FC<DirectoryAutocompleteProps> = ({
  directories,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigationScheduledRef = useRef<number | null>(null);

  // Format path to show last part
  const formatPath = (path: string) => {
    if (path.length <= 45) return path;
    return '...' + path.slice(-42);
  };

  // Reset selection when directories change
  useEffect(() => {
    setSelectedIndex(0);
  }, [directories]);

  // Handle keyboard navigation
  useEffect(() => {
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
            prev < directories.length - 1 ? prev + 1 : prev
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
        if (directories[selectedIndex]) {
          onSelect(directories[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [directories, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current) {
      const selectedElement = containerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (directories.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-black border border-[var(--text-dim)] mt-1 max-h-48 overflow-y-auto w-full"
    >
      {directories.map((dir, index) => (
        <div
          key={dir}
          className={`px-3 py-2 cursor-pointer text-xs font-mono transition-opacity border-l-2 ${
            index === selectedIndex
              ? 'bg-[#FF4D00]/10 text-[var(--text-primary)] border-[#FF4D00]'
              : 'text-[var(--text-primary)] hover:opacity-70 border-transparent hover:border-[#FF4D00]/50'
          }`}
          onClick={() => onSelect(dir)}
          onMouseEnter={() => setSelectedIndex(index)}
          title={dir}
        >
          <div className="flex items-center gap-2">
            <span className={`flex-shrink-0 ${index === selectedIndex ? 'text-[#FF4D00]' : 'text-[var(--text-dim)]'}`}>
              [DIR]
            </span>
            <span className="flex-1">
              {formatPath(dir)}
            </span>
          </div>
        </div>
      ))}
      <div className="px-3 py-1 text-[10px] text-[var(--text-dim)] border-t border-[var(--text-dim)] bg-black font-mono uppercase tracking-wider">
        ↑↓ navigate • ⏎ select • esc close
      </div>
    </div>
  );
};

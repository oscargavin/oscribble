import React, { useEffect, useState, useRef } from 'react';

interface FileAutocompleteProps {
  files: string[];
  query: string;
  onSelect: (file: string) => void;
  onClose: () => void;
}

export const FileAutocomplete: React.FC<FileAutocompleteProps> = ({
  files,
  query,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter files based on query
  const filteredFiles = files
    .filter((file) => {
      const lowerFile = file.toLowerCase();
      const lowerQuery = query.toLowerCase();
      return lowerFile.includes(lowerQuery);
    })
    .slice(0, 10); // Show max 10 results

  // Reset selection when filtered files change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          onSelect(filteredFiles[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current) {
      const selectedElement = containerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (filteredFiles.length === 0) {
    return (
      <div
        className="absolute bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10 p-3 text-xs font-mono text-[#E6E6E6]/50"
      >
        $ no files found
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10 max-h-64 overflow-y-auto"
    >
      {filteredFiles.map((file, index) => (
        <div
          key={file}
          className={`px-3 py-2 cursor-pointer text-xs font-mono transition-all duration-150 border-l-2 ${
            index === selectedIndex
              ? 'bg-[#FF4D00]/10 text-[#E6E6E6] border-[#FF4D00]'
              : 'text-[#E6E6E6] hover:bg-[#111] border-transparent hover:border-[#FF4D00]/50'
          }`}
          onClick={() => onSelect(file)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className={index === selectedIndex ? 'text-[#FF4D00]' : 'text-[#E6E6E6]/50'}>
            $
          </span>{' '}
          {file}
        </div>
      ))}
      <div className="px-3 py-1 text-[10px] text-[#E6E6E6]/50 border-t border-white/10 bg-black font-mono">
        ↑↓ navigate • ⏎ select • esc close
      </div>
    </div>
  );
};

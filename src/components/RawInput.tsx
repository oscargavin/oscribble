import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileAutocomplete } from './FileAutocomplete';

interface RawInputProps {
  initialValue: string;
  projectName: string;
  projectRoot: string;
  onFormat: (rawText: string, contextStr: string, isVoiceInput?: boolean, contextFiles?: { path: string; wasGrepped?: boolean; matchedKeywords?: string[]; }[]) => Promise<void>;
}

export const RawInput: React.FC<RawInputProps> = ({
  initialValue,
  projectName,
  projectRoot,
  onFormat,
}) => {
  const [rawText, setRawText] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [formatStatus, setFormatStatus] = useState<string>('');
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const editableRef = useRef<HTMLDivElement>(null);

  // Update local state when initialValue changes (e.g., after formatting or project switch)
  useEffect(() => {
    setRawText(initialValue);
    if (editableRef.current) {
      editableRef.current.textContent = initialValue;
    }
  }, [initialValue]);

  // Sync contenteditable when rawText changes programmatically
  useEffect(() => {
    if (editableRef.current && editableRef.current.textContent !== rawText) {
      const cursorPos = getCursorPosition();
      editableRef.current.textContent = rawText;
      // Restore cursor position after update
      setTimeout(() => setCursorPos(cursorPos), 0);
    }
  }, [rawText]);

  // Load project files on mount or when project changes
  useEffect(() => {
    const loadFiles = async () => {
      const result = await window.electronAPI.getProjectFiles(projectRoot);
      if (result.success) {
        setProjectFiles(result.files);
      }
    };
    loadFiles();
  }, [projectRoot]);

  // Helper: Get cursor position in contenteditable
  const getCursorPosition = (): number => {
    const selection = window.getSelection();
    if (!selection || !editableRef.current) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editableRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  // Helper: Set cursor position in contenteditable
  const setCursorPos = (pos: number) => {
    if (!editableRef.current) return;

    const selection = window.getSelection();
    if (!selection) return;

    let charCount = 0;
    const nodeStack: Node[] = [editableRef.current];
    let node: Node | undefined;
    let foundStart = false;

    while (!foundStart && (node = nodeStack.pop())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const nextCharCount = charCount + textNode.length;
        if (pos <= nextCharCount) {
          const range = document.createRange();
          range.setStart(textNode, pos - charCount);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          foundStart = true;
        }
        charCount = nextCharCount;
      } else {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }
  };

  // Auto-focus editable div on mount and position cursor at end
  useEffect(() => {
    if (editableRef.current) {
      editableRef.current.focus();
      // Set cursor position to end of existing text
      const length = rawText.length;
      setCursorPos(length);
    }
  }, []);

  // Detect @mentions
  const mentions = useMemo(() => {
    return rawText.match(/@[\w\/\-\.]+/g) || [];
  }, [rawText]);

  // Render formatted text with visual line markers
  const renderFormattedBackground = () => {
    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      const indentLevel = Math.floor(line.search(/\S/) / 2);
      const trimmedLine = line.trim();

      // Add subtle tree arm for non-empty lines with indent > 0
      const showArm = trimmedLine.length > 0 && indentLevel > 0;

      return (
        <div key={idx} className="formatted-line">
          {showArm && (
            <span
              className="line-arm"
              style={{ left: `${(indentLevel - 1) * 16}px` }}
            >
              └─{' '}
            </span>
          )}
          <span className="line-content">{line || '\u00A0'}</span>
        </div>
      );
    });
  };

  // Debounced autosave
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (rawText !== initialValue) {
        setSaving(true);
        try {
          await window.electronAPI.saveRaw(projectName, rawText);
          // Keep the indicator visible for a brief period after save completes
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
          console.error('Failed to save:', error);
        } finally {
          setSaving(false);
        }
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [rawText, projectName, initialValue]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const start = getCursorPosition();
    const end = start; // For now, assume no selection

    // Cmd+L to clear all text
    if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
      e.preventDefault();
      setRawText('');
      if (editableRef.current) {
        editableRef.current.textContent = '';
      }
      return;
    }

    // Shift+Enter to format
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      if (!formatting && rawText.trim()) {
        handleFormat();
      }
      return;
    }

    // Enter to continue indentation from previous line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // Find the current line
      const textBeforeCursor = rawText.substring(0, start);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      // Calculate indentation level (count leading spaces)
      const indentMatch = currentLine.match(/^(\s*)/);
      const indentation = indentMatch ? indentMatch[1] : '';

      // Insert newline with same indentation
      const textAfterCursor = rawText.substring(end);
      const newText = rawText.substring(0, start) + '\n' + indentation + textAfterCursor;
      const newCursorPos = start + 1 + indentation.length;

      setRawText(newText);
      setTimeout(() => {
        setCursorPos(newCursorPos);
      }, 0);
      return;
    }

    // Tab to indent
    if (e.key === 'Tab') {
      e.preventDefault();

      if (e.shiftKey) {
        // Shift+Tab to unindent
        const lines = rawText.split('\n');
        const cursorLine = rawText.substring(0, start).split('\n').length - 1;

        if (lines[cursorLine].startsWith('  ')) {
          lines[cursorLine] = lines[cursorLine].substring(2);
          const newText = lines.join('\n');
          const newCursorPos = Math.max(0, start - 2);

          setRawText(newText);
          setTimeout(() => {
            setCursorPos(newCursorPos);
          }, 0);
        }
      } else {
        // Tab to indent (add 2 spaces at start of line)
        const lines = rawText.split('\n');
        const cursorLine = rawText.substring(0, start).split('\n').length - 1;

        lines[cursorLine] = '  ' + lines[cursorLine];
        const newText = lines.join('\n');
        const newCursorPos = start + 2;

        setRawText(newText);
        setTimeout(() => {
          setCursorPos(newCursorPos);
        }, 0);
      }
      return;
    }
  };

  // Handle text change and detect @ for autocomplete
  const handleInput = () => {
    if (!editableRef.current) return;

    const newText = editableRef.current.textContent || '';
    const cursorPos = getCursorPosition();

    setRawText(newText);
    setCursorPosition(cursorPos);

    // Check if @ was just typed
    const textBeforeCursor = newText.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // Check if we're still in a mention (no spaces after @)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setAutocompleteQuery(textAfterAt);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  // Handle file selection from autocomplete
  const handleFileSelect = (file: string) => {
    if (editableRef.current) {
      const textBeforeCursor = rawText.substring(0, cursorPosition);
      const textAfterCursor = rawText.substring(cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const newText =
          rawText.substring(0, lastAtIndex) +
          `@${file}` +
          textAfterCursor;

        setRawText(newText);
        setShowAutocomplete(false);

        // Set cursor position after the inserted file
        setTimeout(() => {
          const newCursorPos = lastAtIndex + file.length + 1;
          setCursorPos(newCursorPos);
          editableRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleFormat = async () => {
    setFormatting(true);
    setFormatStatus('GATHERING');
    try {
      // Gather context from @mentions and auto-discovery
      const contextResult = await window.electronAPI.gatherProjectContext(
        rawText,
        projectRoot
      );

      if (!contextResult.success) {
        throw new Error(contextResult.error || 'Failed to gather context');
      }

      // Format gathered context for Claude
      let contextString = '';
      let contextFiles: { path: string; wasGrepped?: boolean; matchedKeywords?: string[]; }[] = [];
      if (contextResult.data) {
        const gc = contextResult.data;
        contextString = gc.files.map(f => {
          const header = f.wasGrepped
            ? `--- ${f.path} (grep: ${f.matchedKeywords?.join(', ')}) ---`
            : `--- ${f.path} ---`;
          return `${header}\n${f.content}`;
        }).join('\n\n');

        // Extract file metadata for storage with tasks
        contextFiles = gc.files.map(f => ({
          path: f.path,
          wasGrepped: f.wasGrepped,
          matchedKeywords: f.matchedKeywords
        }));

        console.log(`Context: ${gc.files.length} files, ${gc.totalLines} lines (${gc.cacheHits} cached)`);
      }

      setFormatStatus('ANALYZING');
      await onFormat(rawText, contextString, false, contextFiles);

      setFormatStatus('FORMATTING');
    } catch (error) {
      console.error('Format error:', error);
      alert(`Failed to format: ${error.message}`);
    } finally {
      setFormatting(false);
      setFormatStatus('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="flex items-center justify-between p-3 border-b border-[#222222] bg-[#0A0A0A]">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-mono text-[#E6E6E6] uppercase tracking-wider">
            [RAW INPUT]
          </h2>
          {mentions.length > 0 && (
            <span className="text-xs text-[#FF4D00] font-mono">
              {mentions.length} @{mentions.length !== 1 ? 'FILES' : 'FILE'}
            </span>
          )}
          {saving && (
            <span className="text-xs text-[#888888] font-mono uppercase">SAVING...</span>
          )}
        </div>
        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={handleFormat}
            disabled={formatting || !rawText.trim()}
            className="px-4 py-2 text-xs font-mono uppercase tracking-wider border border-[#FF4D00] text-[#FF4D00] bg-transparent hover:bg-[#FF4D00] hover:text-[#000000] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-2"
          >
            {formatting ? (
              <span className="loading-ellipsis">{formatStatus}</span>
            ) : (
              'FORMAT'
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto relative">
        <div className="relative h-full">
          {/* Background formatting layer */}
          <div className="formatted-background">
            {renderFormattedBackground()}
          </div>

          {/* Foreground contenteditable */}
          <div
            ref={editableRef}
            contentEditable={!formatting}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            suppressContentEditableWarning
            className="raw-input-textarea"
            spellCheck={false}
            data-placeholder="Enter your tasks here...

Examples:
- Fix login bug
- Optimize database queries
- Type @ to mention files
- Add tests for auth flow"
          >
            {rawText}
          </div>
        </div>

        {showAutocomplete && (
          <FileAutocomplete
            files={projectFiles}
            query={autocompleteQuery}
            onSelect={handleFileSelect}
            onClose={() => setShowAutocomplete(false)}
          />
        )}
      </div>

      {/* Keyboard shortcut hints */}
      <div className="flex items-center gap-4 p-3 border-t border-[#222222] overflow-x-auto flex-nowrap bg-[#0A0A0A]">
            <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
              <span className="text-[#666666]">+</span>
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">T</kbd>
              <span className="text-[#888888] text-xs font-mono uppercase">TOGGLE VIEW</span>
            </div>
            <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
              <span className="text-[#666666]">+</span>
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">O</kbd>
              <span className="text-[#888888] text-xs font-mono uppercase">CONTEXT FILES</span>
            </div>
            <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">CMD</kbd>
              <span className="text-[#666666]">+</span>
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">L</kbd>
              <span className="text-[#888888] text-xs font-mono uppercase">CLEAR</span>
            </div>
            <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">SHIFT</kbd>
              <span className="text-[#666666]">+</span>
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">ENTER</kbd>
              <span className="text-[#888888] text-xs font-mono uppercase">FORMAT</span>
            </div>
            <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">TAB</kbd>
              <span className="text-[#888888] text-xs font-mono uppercase">INDENT</span>
            </div>
            <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">SHIFT</kbd>
              <span className="text-[#666666]">+</span>
              <kbd className="px-3 py-1.5 border border-[#E6E6E6] text-[#E6E6E6] text-xs font-mono bg-transparent min-w-[32px] text-center">TAB</kbd>
              <span className="text-[#888888] text-xs font-mono uppercase">UNINDENT</span>
            </div>
            <div className="keyboard-hint whitespace-nowrap flex items-center gap-2">
              <kbd className="px-3 py-1.5 border border-[#FF4D00] text-[#FF4D00] text-xs font-mono bg-transparent min-w-[32px] text-center">@</kbd>
              <span className="text-[#888888] text-xs font-mono uppercase">MENTION</span>
            </div>
      </div>

      {mentions.length > 0 && (
        <div className="p-3 border-t border-[#222222] bg-[#0A0A0A]">
          <div className="text-xs text-[#888888] mb-2 font-mono uppercase tracking-wider">
            [DETECTED FILES]
          </div>
          <div className="flex flex-wrap gap-2">
            {mentions.map((mention, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs border border-[#FF4D00] text-[#FF4D00] font-mono bg-transparent"
              >
                {mention}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { TaskNode } from "../../../types";
import { Checkbox } from "../../ui/checkbox";
import { SubtaskTimeline } from "./SubtaskTimeline";
import { CitedText } from "../../../utils/citationParser";

interface TaskRowProps {
  task: TaskNode;
  onToggle: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onIndentChange: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onMetadataChange: (id: string, metadata: TaskNode["metadata"]) => void;
  onFormat: (id: string, useAutocontext?: boolean) => void;
  onFocus: (id: string) => void;
  isFocused: boolean;
  isSelected: boolean;
  isFirstSelected?: boolean;
  isLastSelected?: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  expandedTasks: Set<string>;
  isFormattingTaskId: string | null;
  depth?: number;
  showContextFiles: Set<string>;
  focusedSubtaskId?: string | null;
  onSubtaskFocus?: (subtaskId: string | null) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onToggle,
  onTextChange,
  onIndentChange,
  onDelete,
  onMetadataChange,
  onFormat,
  onFocus,
  isFocused,
  isSelected,
  isFirstSelected = false,
  isLastSelected = false,
  isExpanded,
  onToggleExpand,
  expandedTasks,
  isFormattingTaskId,
  depth = 0,
  showContextFiles,
  focusedSubtaskId,
  onSubtaskFocus,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [metadataForm, setMetadataForm] = useState({
    priority: (task.metadata?.priority || "") as "" | "high" | "medium" | "low",
    deadline: task.metadata?.deadline || "",
    effort_estimate: task.metadata?.effort_estimate || "",
    tags: task.metadata?.tags?.join(", ") || "",
  });

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(task.text);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editText !== task.text) {
      onTextChange(task.id, editText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(task.text);
    } else if (e.key === "Tab") {
      e.preventDefault();
      onIndentChange(task.id, e.shiftKey ? -1 : 1);
    }
  };

  const handleMetadataEdit = () => {
    setIsEditingMetadata(true);
    setMetadataForm({
      priority: (task.metadata?.priority || "") as
        | ""
        | "high"
        | "medium"
        | "low",
      deadline: task.metadata?.deadline || "",
      effort_estimate: task.metadata?.effort_estimate || "",
      tags: task.metadata?.tags?.join(", ") || "",
    });
  };

  const handleMetadataSave = () => {
    // Check if priority was changed
    const priorityChanged =
      metadataForm.priority &&
      metadataForm.priority !== task.metadata?.priority;

    const updatedMetadata = {
      ...task.metadata,
      priority: metadataForm.priority || undefined,
      original_priority: priorityChanged
        ? task.metadata?.original_priority || task.metadata?.priority
        : task.metadata?.original_priority,
      priority_edited:
        priorityChanged || task.metadata?.priority_edited || false,
      deadline: metadataForm.deadline.trim() || undefined,
      effort_estimate: metadataForm.effort_estimate.trim() || undefined,
      tags: metadataForm.tags.trim()
        ? metadataForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : undefined,
    };

    onMetadataChange(task.id, updatedMetadata);
    setIsEditingMetadata(false);
  };

  const handleMetadataCancel = () => {
    setIsEditingMetadata(false);
    setMetadataForm({
      priority: (task.metadata?.priority || "") as
        | ""
        | "high"
        | "medium"
        | "low",
      deadline: task.metadata?.deadline || "",
      effort_estimate: task.metadata?.effort_estimate || "",
      tags: task.metadata?.tags?.join(", ") || "",
    });
  };

  const handleMetadataKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleMetadataSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleMetadataCancel();
    }
  };

  // Listen for keyboard shortcuts
  useEffect(() => {
    if (isFocused && !isEditing && !isEditingMetadata) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === "m" || e.key === "M") && e.target === document.body) {
          e.preventDefault();
          handleMetadataEdit();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isFocused, isEditing, isEditingMetadata]);

  const handleCopy = async () => {
    // Format the task content for copying
    let copyText = task.text;

    // Add priority if present
    if (task.metadata?.priority) {
      copyText += `\nPriority: ${task.metadata.priority}`;
    }

    // Add notes if present (now an array)
    if (task.metadata?.notes && task.metadata.notes.length > 0) {
      copyText += `\nNotes:\n${task.metadata.notes.map((note) => `  - ${note}`).join("\n")}`;
    }

    // Add deadline if present
    if (task.metadata?.deadline) {
      copyText += `\nDeadline: ${task.metadata.deadline}`;
    }

    // Add effort estimate if present
    if (task.metadata?.effort_estimate) {
      copyText += `\nEstimate: ${task.metadata.effort_estimate}`;
    }

    // Add tags if present
    if (task.metadata?.tags && task.metadata.tags.length > 0) {
      copyText += `\nTags: ${task.metadata.tags.join(", ")}`;
    }

    // Add blocked_by if present
    if (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) {
      copyText += `\nBlocked by: ${task.metadata.blocked_by.join(", ")}`;
    }

    // Add depends_on if present
    if (task.metadata?.depends_on && task.metadata.depends_on.length > 0) {
      copyText += `\nDepends on: ${task.metadata.depends_on.join(", ")}`;
    }

    // Add related_to if present
    if (task.metadata?.related_to && task.metadata.related_to.length > 0) {
      copyText += `\nRelated: ${task.metadata.related_to.join(", ")}`;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getPriorityStyles = () => {
    // Border-l visual indicators removed - priority now only shown via badges
    return "";
  };

  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return "border-[var(--accent-orange)] text-[var(--accent-orange)]";
      case "medium":
        return "border-[var(--text-secondary)] text-[var(--text-secondary)]";
      case "low":
        return "border-[var(--text-dim)] text-[var(--text-dim)]";
    }
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  const isRawTask = task.metadata?.formatted === false;

  // Build selection border classes for continuous rectangle effect
  const getSelectionBorderClasses = () => {
    // Don't apply selection borders when task is expanded with subtasks (border is on outer wrapper)
    if (!isSelected || (isExpanded && hasSubtasks)) return "";

    const classes = ["bg-[var(--accent-orange)]/10"];

    // Single selected task gets full border
    if (isFirstSelected && isLastSelected) {
      classes.push("border-2 border-[var(--accent-orange)]");
    } else {
      // Left and right borders always present when selected
      classes.push(
        "border-l-2 border-l-[var(--accent-orange)]",
        "border-r-2 border-r-[var(--accent-orange)]"
      );

      // Top border only on first selected, otherwise transparent
      if (isFirstSelected) {
        classes.push("border-t-2 border-t-[var(--accent-orange)]");
      } else {
        classes.push("border-t-2 border-t-transparent");
      }

      // Bottom border only on last selected, otherwise transparent
      if (isLastSelected) {
        classes.push("border-b-2 border-b-[var(--accent-orange)]");
      } else {
        classes.push("border-b-2 border-b-transparent");
      }
    }

    return classes.join(" ");
  };

  return (
    <div
      className={`${isExpanded && hasSubtasks && isFocused ? "border border-[var(--accent-orange)] bg-[var(--accent-orange)]/[0.015]" : ""} ${isExpanded && hasSubtasks && !isFocused ? "border-b-2 border-b-[var(--bg-surface)]" : ""}`}
    >
      <div
        data-task-id={task.id}
        className={`flex items-start gap-3 p-3 border-2 ${
          isExpanded && hasSubtasks
            ? "border-transparent"
            : !isSelected && !isFocused
              ? "border-transparent border-b-2 border-b-[var(--bg-surface)]"
              : ""
        } hover:bg-[var(--bg-elevated)] transition-colors duration-150 relative group cursor-pointer ${getPriorityStyles()} ${isFocused && !(isExpanded && hasSubtasks) ? "!border border-[var(--accent-orange)] bg-[var(--accent-orange)]/[0.015]" : ""} ${getSelectionBorderClasses()}`}
        style={{
          marginLeft: `${(task.indent + depth) * 20}px`,
          minHeight: isRawTask ? "96px" : undefined, // Extra height for raw tasks to fit buttons below badges
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => {
          // Don't trigger focus if clicking on interactive elements
          if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLButtonElement ||
            (e.target as HTMLElement).closest("button")
          ) {
            return;
          }
          // Focus this task
          onFocus(task.id);
        }}
      >
        <div className="relative flex-shrink-0">
          <Checkbox
            checked={task.checked}
            onCheckedChange={() => onToggle(task.id)}
            className={`mt-1 cursor-pointer ${
              task.metadata?.start_time && !task.metadata?.duration
                ? "!bg-[#FFAA00]/20 !border-[#FFAA00] animate-pulse-glow"
                : ""
            }`}
          />
        </div>

        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-1 bg-[var(--bg-elevated)] text-[var(--text-primary)] px-2 py-1 border border-[var(--accent-orange)] outline-none text-sm font-mono"
          />
        ) : isEditingMetadata ? (
          <div className="flex-1 space-y-2 py-1">
            {task.metadata?.priority && (
              <div className="flex items-center gap-2">
                <label className="text-[var(--text-primary)] text-xs font-mono w-16">
                  PRIORITY:
                </label>
                <div className="flex gap-2">
                  {(["high", "medium", "low"] as const).map((priority) => (
                    <button
                      key={priority}
                      onClick={() =>
                        setMetadataForm({ ...metadataForm, priority })
                      }
                      className={`px-2 py-1 text-xs font-mono uppercase border ${
                        metadataForm.priority === priority
                          ? priority === "high"
                            ? "border-[var(--accent-orange)] text-[var(--accent-orange)] bg-[var(--accent-orange)]/20"
                            : priority === "medium"
                              ? "border-[var(--text-secondary)] text-[var(--text-secondary)] bg-[var(--text-secondary)]/20"
                              : "border-[var(--text-dim)] text-[var(--text-dim)] bg-[var(--text-dim)]/20"
                          : "border-[var(--border-accent)] text-[var(--text-secondary)] hover:border-[var(--text-dim)]"
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
                {task.metadata.original_priority &&
                  task.metadata.original_priority !== metadataForm.priority && (
                    <span className="text-[var(--text-dim)] text-[10px] font-mono ml-auto">
                      Claude: {task.metadata.original_priority}
                    </span>
                  )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-[var(--text-primary)] text-xs font-mono w-16">
                DUE:
              </label>
              <input
                type="text"
                value={metadataForm.deadline}
                onChange={(e) =>
                  setMetadataForm({ ...metadataForm, deadline: e.target.value })
                }
                onKeyDown={handleMetadataKeyDown}
                placeholder="e.g., 2024-12-31, next week"
                className="flex-1 bg-transparent text-[var(--text-primary)] px-2 py-1 border border-[var(--accent-orange)] outline-none text-xs font-mono"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[var(--text-primary)] text-xs font-mono w-16">
                EST:
              </label>
              <input
                type="text"
                value={metadataForm.effort_estimate}
                onChange={(e) =>
                  setMetadataForm({
                    ...metadataForm,
                    effort_estimate: e.target.value,
                  })
                }
                onKeyDown={handleMetadataKeyDown}
                placeholder="e.g., 2h, 1d, 30min"
                className="flex-1 bg-transparent text-[var(--text-primary)] px-2 py-1 border border-[var(--accent-orange)] outline-none text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[var(--text-primary)] text-xs font-mono w-16">
                TAGS:
              </label>
              <input
                type="text"
                value={metadataForm.tags}
                onChange={(e) =>
                  setMetadataForm({ ...metadataForm, tags: e.target.value })
                }
                onKeyDown={handleMetadataKeyDown}
                placeholder="e.g., urgent, backend, bug"
                className="flex-1 bg-transparent text-[var(--text-primary)] px-2 py-1 border border-[var(--accent-orange)] outline-none text-xs font-mono"
              />
            </div>
            <div className="flex gap-2 text-xs font-mono">
              <button
                onClick={handleMetadataSave}
                className="px-2 py-1 border border-[var(--text-primary)] text-[var(--text-primary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] transition-colors uppercase"
              >
                [ENTER] SAVE
              </button>
              <button
                onClick={handleMetadataCancel}
                className="px-2 py-1 border border-[var(--text-dim)] text-[var(--text-dim)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors uppercase"
              >
                [ESC] CANCEL
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex-1 cursor-pointer"
            onDoubleClick={handleDoubleClick}
          >
            <div className="flex gap-2 items-start">
              {hasSubtasks ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(task.id);
                  }}
                  className="text-[var(--accent-orange)] flex-shrink-0 hover:text-[var(--text-primary)] transition-colors leading-none mt-[2px]"
                  title={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              ) : (
                <span className="text-[var(--accent-orange)] flex-shrink-0 leading-none mt-[2px]">
                  ▸
                </span>
              )}
              <span
                className={`text-sm font-mono ${task.checked ? "line-through text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}
              >
                {task.text}
              </span>
              {hasSubtasks && (
                <span className="text-xs text-[var(--text-dim)] font-mono">
                  [{task.subtasks!.length}]
                </span>
              )}
            </div>
            {task.metadata?.notes && task.metadata.notes.length > 0 && (
              <div className="text-xs text-[var(--text-secondary)] mt-1 font-mono pl-4 relative">
                {/* Vertical trunk line for all notes except after the last one */}
                <div
                  className="absolute left-[1.2rem] top-0 bottom-0 w-[1px] bg-[var(--border-subtle)]"
                  style={{ height: "calc(100% - 1em)" }}
                />

                {task.metadata.notes.map((note, index) => {
                  const isLast = index === task.metadata!.notes!.length - 1;
                  const branch = isLast ? "└─" : "├─";
                  return (
                    <div
                      key={index}
                      className="flex items-start relative"
                      style={{ lineHeight: "1.2" }}
                    >
                      <span className="text-[var(--border-subtle)] mr-1 flex-shrink-0 z-10 bg-[var(--bg-primary)]">
                        {branch}
                      </span>
                      <span className="flex-1">
                        <CitedText text={note} citations={task.metadata?.citations} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Context used */}
            {task.metadata?.notes &&
              task.metadata.notes.some((note) =>
                note.startsWith("Context:")
              ) && (
                <div className="mt-1 text-xs text-[var(--text-dim)] pl-4 font-mono border-l border-[var(--border-accent)]">
                  <div className="font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                    [CONTEXT]
                  </div>
                  {task.metadata.notes
                    .filter((note) => note.startsWith("Context:"))
                    .map((note, i) => (
                      <div key={i} className="ml-2 text-[var(--text-dim)]">
                        • {note.replace("Context: ", "")}
                      </div>
                    ))}
                </div>
              )}
            {task.metadata?.blocked_by &&
              task.metadata.blocked_by.length > 0 && (
                <div className="text-xs text-[var(--accent-orange)] mt-1 font-mono pl-4 border-l border-[var(--accent-orange)]">
                  [BLOCKED] {task.metadata.blocked_by.join(", ")}
                </div>
              )}
            {task.metadata?.depends_on &&
              task.metadata.depends_on.length > 0 && (
                <div className="text-xs text-[var(--text-secondary)] mt-1 font-mono pl-4 border-l border-[var(--text-secondary)]">
                  [DEPENDS] {task.metadata.depends_on.join(", ")}
                </div>
              )}
            {task.metadata?.related_to &&
              task.metadata.related_to.length > 0 && (
                <div className="text-xs text-[var(--text-dim)] mt-1 font-mono pl-4 border-l border-[var(--text-dim)]">
                  [RELATED] {task.metadata.related_to.join(", ")}
                </div>
              )}
            {task.metadata?.tags && task.metadata.tags.length > 0 && (
              <div className="flex gap-2 mt-1 pl-4">
                {task.metadata.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-0.5 border border-[var(--border-subtle)] text-[var(--text-dim)] font-mono uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {/* Priority, DUE and EST badges */}
            {(task.metadata?.priority || task.metadata?.deadline || task.metadata?.effort_estimate || task.metadata?.attempts) && (
              <div className="flex gap-2 mt-1 pl-4">
                {task.metadata?.priority && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMetadataEdit();
                    }}
                    className={`text-xs px-2 py-0.5 border bg-transparent font-mono uppercase tracking-wider hover:opacity-80 transition-opacity ${getPriorityColor(task.metadata.priority)}`}
                    title={`Click to edit priority (M)${task.metadata.priority_edited ? " (edited by you)" : ""}`}
                  >
                    {task.metadata.priority}
                    {task.metadata.priority_edited && (
                      <span className="ml-1 text-[10px]">*</span>
                    )}
                  </button>
                )}
                {task.metadata?.deadline && (
                  <span className="text-xs px-2 py-0.5 border border-[var(--border-accent)] text-[var(--text-secondary)] font-mono uppercase tracking-wider">
                    DUE: {task.metadata.deadline}
                  </span>
                )}
                {task.metadata?.effort_estimate && (
                  <span className="text-xs px-2 py-0.5 border border-[var(--border-subtle)] text-[var(--text-dim)] font-mono uppercase tracking-wider">
                    EST: {task.metadata.effort_estimate}
                  </span>
                )}
                {task.metadata?.attempts && task.metadata.attempts.length > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 border font-mono uppercase tracking-wider flex items-center gap-1 ${
                      task.metadata.attempts.length === 1
                        ? "border-[#FFAA00] text-[#FFAA00]"  // Yellow for 1 attempt
                        : task.metadata.attempts.length === 2
                        ? "border-[var(--accent-orange)] text-[var(--accent-orange)]"  // Orange for 2 attempts
                        : "border-[#FF0000] text-[#FF0000]"  // Red for 3+ attempts
                    }`}
                    title={`${task.metadata.attempts.length} failed attempt${task.metadata.attempts.length > 1 ? 's' : ''} (view details with oscribble_get_task_details)`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {task.metadata.attempts.length}×
                  </span>
                )}
              </div>
            )}
            {showContextFiles.has(task.id) &&
              task.metadata?.context_files &&
              task.metadata.context_files.length > 0 && (
                <div className="mt-1 text-xs text-[var(--text-dim)] pl-4 font-mono border-l border-[var(--border-accent)]">
                  <div className="font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                    [CONTEXT FILES]
                  </div>
                  {task.metadata.context_files.map((file, i) => (
                    <div key={i} className="ml-2 text-[var(--text-dim)]">
                      • {file.path}
                      {file.wasGrepped && file.matchedKeywords && (
                        <span className="text-[var(--text-muted)]">
                          {" "}
                          (grep: {file.matchedKeywords.join(", ")})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* Badges for raw tasks - placed inline */}
        {isRawTask && (
          <>
            <span className="text-xs px-2 py-1 border border-[var(--text-muted)] bg-transparent text-[var(--text-secondary)] font-mono uppercase tracking-wider ml-auto">
              FEATURE
            </span>
            <span className="text-xs px-2 py-1 border border-[var(--accent-orange)] bg-transparent text-[var(--accent-orange)] font-mono uppercase tracking-wider">
              [RAW]
            </span>
          </>
        )}

        {/* Buttons - absolute positioned at bottom right for all tasks */}
        {isHovered && !isEditing && !isEditingMetadata && (
          <div className="absolute right-3 bottom-3 flex gap-1">
            {/* Format button - only for raw tasks */}
            {isRawTask && (
              <button
                onClick={() => onFormat(task.id, true)}
                disabled={isFormattingTaskId === task.id}
                className={`transition-colors duration-150 p-1 border bg-[var(--bg-base)] ${
                  isFormattingTaskId === task.id
                    ? "text-[var(--text-secondary)] border-[var(--text-secondary)] cursor-not-allowed"
                    : "text-[var(--accent-orange)] hover:text-[var(--text-primary)] border-[var(--accent-orange)] hover:border-[var(--text-primary)]"
                }`}
                title={
                  isFormattingTaskId === task.id
                    ? "Formatting..."
                    : "Format with context (CMD+F) | No context (CMD+SHIFT+F)"
                }
              >
                {isFormattingTaskId === task.id ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-spin"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                )}
              </button>
            )}
            <button
              onClick={handleMetadataEdit}
              className="text-[var(--text-primary)] hover:text-[var(--accent-orange)] transition-colors duration-150 p-1 border border-[var(--text-primary)] hover:border-[var(--accent-orange)] bg-[var(--bg-base)]"
              title="Edit metadata (M)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <button
              onClick={handleCopy}
              className="text-[var(--text-primary)] hover:text-[var(--accent-orange)] transition-colors duration-150 p-1 border border-[var(--text-primary)] hover:border-[var(--accent-orange)] bg-[var(--bg-base)]"
              title={isCopied ? "Copied!" : "Copy task to clipboard"}
            >
              {isCopied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[var(--accent-orange)]"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="text-[var(--text-primary)] hover:text-[var(--accent-orange)] transition-colors duration-150 p-1 border border-[var(--text-primary)] hover:border-[var(--accent-orange)] bg-[var(--bg-base)]"
              title="Delete task"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Render subtasks as timeline if expanded */}
      <SubtaskTimeline
        task={task}
        isExpanded={isExpanded}
        depth={depth}
        focusedSubtaskId={focusedSubtaskId || null}
        onToggle={onToggle}
        onSubtaskFocus={onSubtaskFocus}
      />
    </div>
  );
};

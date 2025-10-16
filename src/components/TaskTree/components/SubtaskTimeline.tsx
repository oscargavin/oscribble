import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TaskNode } from "../../../types";
import { Checkbox } from "../../ui/checkbox";
import { CitedText } from "../../../utils/citationParser";

interface SubtaskTimelineProps {
  task: TaskNode;
  isExpanded: boolean;
  depth: number;
  focusedSubtaskId: string | null;
  onToggle: (id: string) => void;
  onSubtaskFocus?: (subtaskId: string | null) => void;
}

export const SubtaskTimeline: React.FC<SubtaskTimelineProps> = ({
  task,
  isExpanded,
  depth,
  focusedSubtaskId,
  onToggle,
  onSubtaskFocus,
}) => {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  if (!isExpanded || !hasSubtasks) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mt-2"
      style={{ marginLeft: `${(task.indent + depth) * 20 + 40}px` }}
    >
      {task.subtasks!.map((subtask, index) => {
        const isSubtaskFocused = focusedSubtaskId === subtask.id;
        const isLastSubtask = index === task.subtasks!.length - 1;

        return (
          <motion.div
            key={subtask.id}
            data-subtask-id={subtask.id}
            className="relative flex"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {/* Timeline connector */}
            <div className="relative flex-shrink-0 w-8 flex flex-col items-center">
              {/* Vertical line - orange if current subtask is checked (fills from top as tasks complete) */}
              {!isLastSubtask && (
                <div
                  className={`absolute top-5 bottom-[-2px] left-1/2 -translate-x-1/2 w-[2px] transition-colors duration-300 ${
                    subtask.checked ? "bg-[#FF4D00]" : "bg-[#333333]"
                  }`}
                />
              )}

              {/* Checkbox/node */}
              <div className="relative z-10 mt-1">
                <Checkbox
                  checked={subtask.checked}
                  onCheckedChange={() => {
                    onToggle(subtask.id);
                    // Auto-advance to next unchecked subtask
                    if (!subtask.checked && onSubtaskFocus) {
                      const nextUnchecked = task.subtasks!.find(
                        (s, idx) => idx > index && !s.checked
                      );
                      if (nextUnchecked) {
                        onSubtaskFocus(nextUnchecked.id);
                      }
                    }
                  }}
                  className="cursor-pointer"
                />
              </div>
            </div>

            {/* Subtask content */}
            <div className="flex-1 pb-4">
              <motion.div
                className={`pl-3 rounded-sm ${isSubtaskFocused ? "bg-[#0A0A0A]" : ""}`}
                animate={{
                  backgroundColor: isSubtaskFocused ? "#0A0A0A" : "transparent",
                  borderColor: isSubtaskFocused ? "#222222" : "transparent",
                }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                onClick={() =>
                  onSubtaskFocus && onSubtaskFocus(subtask.id)
                }
              >
                {/* Subtask title */}
                <motion.div
                  className="flex items-center gap-2"
                  animate={{
                    x: isSubtaskFocused ? 4 : 0,
                  }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <span
                    className={`text-sm font-mono transition-colors duration-200 ${
                      subtask.checked
                        ? "line-through text-[#666666]"
                        : isSubtaskFocused
                          ? "text-[#FFFFFF]"
                          : "text-[#E6E6E6]"
                    }`}
                  >
                    {index + 1}. {subtask.text}
                  </span>
                </motion.div>

                {/* Metadata - only visible when subtask is focused */}
                <AnimatePresence mode="wait">
                  {isSubtaskFocused && (
                    <motion.div
                      key="subtask-metadata"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="mt-1 space-y-2 overflow-hidden"
                    >
                      {/* Notes as tree structure - only show when focused */}
                      {subtask.metadata?.notes &&
                        subtask.metadata.notes.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: 0.05 }}
                            className="space-y-0 text-xs font-mono relative"
                          >
                            {/* Vertical trunk line for all notes except after the last one */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2, delay: 0.05 }}
                              className="absolute left-[0.2rem] top-0 bottom-0 w-[1px] bg-[#888888]"
                              style={{ height: "calc(100% - 1em)" }}
                            />

                            {subtask.metadata.notes.map(
                              (note, noteIdx) => {
                                const isLastNote =
                                  noteIdx ===
                                  subtask.metadata!.notes!.length - 1;
                                const branch = isLastNote ? "└─" : "├─";
                                return (
                                  <motion.div
                                    key={noteIdx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                      duration: 0.2,
                                      delay: 0.1 + noteIdx * 0.05,
                                    }}
                                    className="flex items-start gap-2 relative"
                                    style={{ lineHeight: "1.2" }}
                                  >
                                    <span className="text-[#888888] flex-shrink-0 mr-1 z-10 bg-[var(--bg-primary)]">
                                      {branch}
                                    </span>
                                    <span className="text-[#888888] flex-1 leading-tight py-0.5">
                                      <CitedText text={note} citations={subtask.metadata?.citations} />
                                    </span>
                                  </motion.div>
                                );
                              }
                            )}
                          </motion.div>
                        )}
                      {/* Priority, DUE and EST as bordered badges - only show when focused */}
                      {(subtask.metadata?.priority ||
                        subtask.metadata?.deadline ||
                        subtask.metadata?.effort_estimate ||
                        subtask.metadata?.attempts) && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: 0.15 }}
                          className="flex flex-wrap gap-2"
                        >
                          {subtask.metadata?.priority && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2, delay: 0.2 }}
                              className={`text-xs px-2 py-0.5 border font-mono uppercase tracking-wider ${
                                subtask.metadata.priority === "high"
                                  ? "border-[#FF4D00] text-[#FF4D00]"
                                  : subtask.metadata.priority ===
                                      "medium"
                                    ? "border-[#888888] text-[#888888]"
                                    : "border-[#666666] text-[#666666]"
                              }`}
                            >
                              {subtask.metadata.priority}
                            </motion.span>
                          )}
                          {subtask.metadata?.deadline && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2, delay: 0.25 }}
                              className="text-xs px-2 py-0.5 border border-[#444444] text-[#888888] font-mono uppercase tracking-wider"
                            >
                              DUE: {subtask.metadata.deadline}
                            </motion.span>
                          )}
                          {subtask.metadata?.effort_estimate && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2, delay: 0.3 }}
                              className="text-xs px-2 py-0.5 border border-[#333333] text-[#666666] font-mono uppercase tracking-wider"
                            >
                              EST: {subtask.metadata.effort_estimate}
                            </motion.span>
                          )}
                          {subtask.metadata?.attempts && subtask.metadata.attempts.length > 0 && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2, delay: 0.35 }}
                              className={`text-xs px-2 py-0.5 border font-mono uppercase tracking-wider flex items-center gap-1 ${
                                subtask.metadata.attempts.length === 1
                                  ? "border-[#FFAA00] text-[#FFAA00]"
                                  : subtask.metadata.attempts.length === 2
                                    ? "border-[#FF4D00] text-[#FF4D00]"
                                    : "border-[#FF0000] text-[#FF0000]"
                              }`}
                              title={`${subtask.metadata.attempts.length} failed attempt${subtask.metadata.attempts.length > 1 ? 's' : ''}`}
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
                              {subtask.metadata.attempts.length}×
                            </motion.span>
                          )}
                        </motion.div>
                      )}
                      {/* Tags as bordered pills - always visible under description */}
                      {subtask.metadata?.tags &&
                        subtask.metadata.tags.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: 0.35 }}
                            className="flex flex-wrap gap-2"
                          >
                            {subtask.metadata.tags.map((tag, tagIdx) => (
                              <motion.span
                                key={tagIdx}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                  duration: 0.2,
                                  delay: 0.4 + tagIdx * 0.05,
                                }}
                                className="text-xs px-2 py-0.5 border border-[#333333] text-[#666666] font-mono uppercase"
                              >
                                {tag}
                              </motion.span>
                            ))}
                          </motion.div>
                        )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

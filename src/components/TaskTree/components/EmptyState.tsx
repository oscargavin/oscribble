import React from "react";

type FilterMode = "all" | "unchecked" | "complete" | "high" | "blocked";

interface EmptyStateProps {
  filterMode: FilterMode;
  hasVoice?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  filterMode,
  hasVoice = false,
}) => {
  const getEmptyMessage = (): string => {
    switch (filterMode) {
      case "unchecked":
        return "[NO UNCOMPLETED TASKS]";
      case "complete":
        return "[NO COMPLETED TASKS]";
      case "high":
        return "[NO HIGH PRIORITY TASKS]";
      case "blocked":
        return "[NO BLOCKED TASKS]";
      case "all":
      default:
        return "[NO TASKS IN VIEW]";
    }
  };

  const getHelpText = () => {
    if (filterMode === "unchecked") {
      return (
        <>
          <div className="text-[var(--text-dim)]">
            Press <span className="text-[var(--text-secondary)]">N</span> for new task
          </div>
          <div className="text-[var(--text-dim)]">
            Press <span className="text-[var(--text-secondary)]">CMD+T</span> for raw text to
            format many tasks
          </div>
          {hasVoice && (
            <div className="text-[var(--text-dim)]">
              Press <span className="text-[var(--text-secondary)]">CMD+R</span> for voice
              input
            </div>
          )}
        </>
      );
    }
    return (
      <div className="text-[var(--border-accent)]">
        Press <span className="text-[var(--text-dim)]">1-5</span> to change filter
      </div>
    );
  };

  return (
    <div className="w-full px-6 py-8">
      <div className="relative border-l-4 border-l-[var(--border-subtle)] border border-[var(--border-primary)] bg-[var(--bg-elevated)] px-8 py-6">
        <div className="text-[var(--text-dim)] text-sm font-mono uppercase tracking-wider text-center font-bold">
          {getEmptyMessage()}
        </div>
        <div className="text-xs font-mono tracking-wider text-center mt-3 space-y-1">
          {getHelpText()}
        </div>
      </div>
    </div>
  );
};

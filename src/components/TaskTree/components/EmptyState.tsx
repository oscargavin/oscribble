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
          <div className="text-[#666666]">
            Press <span className="text-[#888888]">N</span> for new task
          </div>
          <div className="text-[#666666]">
            Press <span className="text-[#888888]">CMD+T</span> for raw text to
            format many tasks
          </div>
          {hasVoice && (
            <div className="text-[#666666]">
              Press <span className="text-[#888888]">CMD+R</span> for voice
              input
            </div>
          )}
        </>
      );
    }
    return (
      <div className="text-[#444444]">
        Press <span className="text-[#666666]">1-5</span> to change filter
      </div>
    );
  };

  return (
    <div className="w-full px-6 py-8">
      <div className="relative border-l-4 border-l-[#333333] border border-[#222222] bg-[#0A0A0A] px-8 py-6">
        <div className="text-[#666666] text-sm font-mono uppercase tracking-wider text-center font-bold">
          {getEmptyMessage()}
        </div>
        <div className="text-xs font-mono tracking-wider text-center mt-3 space-y-1">
          {getHelpText()}
        </div>
      </div>
    </div>
  );
};

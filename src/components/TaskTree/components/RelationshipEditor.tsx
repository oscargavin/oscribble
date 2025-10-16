import React, { useState, useEffect } from "react";
import { TaskNode } from "../../../types";

interface RelationshipEditorProps {
  task: TaskNode;
  allTasks: TaskNode[];
  onSave: (taskId: string, dependsOn: string[], relatedTo: string[]) => void;
  onClose: () => void;
}

export const RelationshipEditor: React.FC<RelationshipEditorProps> = ({
  task,
  allTasks,
  onSave,
  onClose,
}) => {
  const [dependsOnInput, setDependsOnInput] = useState("");
  const [relatedToInput, setRelatedToInput] = useState("");

  // Create a numbered list of all tasks
  const numberedTasks = allTasks.map((t, index) => ({
    number: index + 1,
    id: t.id,
    text: t.text,
  }));

  // Find current task's relationships and convert to numbers
  useEffect(() => {
    const taskToNumber = (taskId: string): number | null => {
      const index = allTasks.findIndex((t) => t.id === taskId);
      return index >= 0 ? index + 1 : null;
    };

    if (task.metadata?.depends_on) {
      const numbers = task.metadata.depends_on
        .map(taskToNumber)
        .filter((n): n is number => n !== null);
      setDependsOnInput(numbers.join(", "));
    }

    if (task.metadata?.related_to) {
      const numbers = task.metadata.related_to
        .map(taskToNumber)
        .filter((n): n is number => n !== null);
      setRelatedToInput(numbers.join(", "));
    }
  }, [task, allTasks]);

  const handleSave = () => {
    // Parse input strings to numbers, then convert to task IDs
    const parseNumbers = (input: string): string[] => {
      if (!input.trim()) return [];

      const numbers = input
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= allTasks.length);

      return numbers.map((n) => allTasks[n - 1].id);
    };

    const dependsOn = parseNumbers(dependsOnInput);
    const relatedTo = parseNumbers(relatedToInput);

    onSave(task.id, dependsOn, relatedTo);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-black border-2 border-[#FF4D00] w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#FF4D00]">
          <h2 className="text-[#E6E6E6] font-mono text-sm uppercase tracking-wider mb-2">
            [EDIT RELATIONSHIPS]
          </h2>
          <p className="text-[#888888] font-mono text-xs">{task.text}</p>
        </div>

        {/* Task list */}
        <div className="p-4 border-b border-[#333333] overflow-auto max-h-[200px]">
          <h3 className="text-[#E6E6E6] font-mono text-xs uppercase tracking-wider mb-2">
            ALL TASKS:
          </h3>
          <div className="space-y-1">
            {numberedTasks.map(({ number, id, text }) => (
              <div
                key={id}
                className={`text-xs font-mono ${
                  id === task.id ? "text-[#FF4D00]" : "text-[#888888]"
                }`}
              >
                {number}. {text} {id === task.id ? "(current)" : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Input fields */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[#E6E6E6] font-mono text-xs uppercase tracking-wider block mb-2">
              DEPENDS ON (comma-separated numbers):
            </label>
            <input
              type="text"
              value={dependsOnInput}
              onChange={(e) => setDependsOnInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 1, 3, 5"
              className="w-full bg-transparent text-[#E6E6E6] px-3 py-2 border border-[#E6E6E6] outline-none text-sm font-mono focus:border-[#FF4D00]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[#E6E6E6] font-mono text-xs uppercase tracking-wider block mb-2">
              RELATED TO (comma-separated numbers):
            </label>
            <input
              type="text"
              value={relatedToInput}
              onChange={(e) => setRelatedToInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 2, 4"
              className="w-full bg-transparent text-[#E6E6E6] px-3 py-2 border border-[#E6E6E6] outline-none text-sm font-mono focus:border-[#FF4D00]"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 border border-[#E6E6E6] text-[#E6E6E6] hover:border-[#FF4D00] hover:text-[#FF4D00] transition-colors uppercase font-mono text-xs tracking-wider"
            >
              [ENTER] SAVE
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[#666666] text-[#666666] hover:border-[#E6E6E6] hover:text-[#E6E6E6] transition-colors uppercase font-mono text-xs tracking-wider"
            >
              [ESC] CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

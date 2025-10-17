import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { TaskNode as TaskNodeType } from '../types';

export interface TaskNodeData {
  task: TaskNodeType;
  onUpdate: (tasks: TaskNodeType[]) => void;
  projectRoot: string;
  projectName: string;
}

export const TaskNode = memo(({ data }: NodeProps) => {
  const { task } = data as TaskNodeData;

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'border-[var(--accent-orange)] text-[var(--accent-orange)]';
      case 'medium':
        return 'border-[var(--text-primary)] text-[var(--text-primary)]';
      case 'low':
        return 'border-[var(--text-dim)] text-[var(--text-dim)]';
    }
  };

  const getPriorityBg = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-[var(--accent-orange)]/10';
      case 'medium':
        return 'bg-[var(--text-primary)]/5';
      case 'low':
        return 'bg-[var(--text-dim)]/5';
    }
  };

  return (
    <div
      className={`relative w-[320px] min-h-[120px] border-2 ${
        task.checked ? 'border-[var(--border-accent)] bg-[var(--bg-elevated)]' : 'border-[var(--text-primary)] bg-[var(--bg-primary)]'
      } ${task.metadata?.priority ? getPriorityBg(task.metadata.priority) : ''} p-3`}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-[var(--accent-orange)] !border-2 !border-[var(--bg-primary)]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-[var(--accent-orange)] !border-2 !border-[var(--bg-primary)]"
      />

      {/* Task content */}
      <div className="flex flex-col gap-2">
        {/* Header with checkbox and priority */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <div
              className={`flex-shrink-0 w-4 h-4 border-2 ${
                task.checked
                  ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]'
                  : 'border-[var(--text-primary)] bg-transparent'
              } flex items-center justify-center cursor-pointer`}
            >
              {task.checked && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 5L4 8L9 2"
                    stroke="var(--bg-primary)"
                    strokeWidth="2"
                    strokeLinecap="square"
                  />
                </svg>
              )}
            </div>
            <span
              className={`text-xs font-mono leading-tight ${
                task.checked ? 'line-through text-[var(--text-dim)]' : 'text-[var(--text-primary)]'
              }`}
            >
              {task.text}
            </span>
          </div>
          {task.metadata?.priority && (
            <span
              className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase tracking-wider flex-shrink-0 ${getPriorityColor(
                task.metadata.priority
              )}`}
            >
              {task.metadata.priority}
            </span>
          )}
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
          {task.metadata?.deadline && (
            <span className="px-1.5 py-0.5 border border-[var(--text-secondary)] text-[var(--text-secondary)]">
              DUE: {task.metadata.deadline}
            </span>
          )}
          {task.metadata?.effort_estimate && (
            <span className="px-1.5 py-0.5 border border-[var(--text-dim)] text-[var(--text-dim)]">
              EST: {task.metadata.effort_estimate}
            </span>
          )}
          {task.metadata?.tags && task.metadata.tags.length > 0 && (
            <>
              {task.metadata.tags.slice(0, 2).map((tag: string, index: number) => (
                <span
                  key={index}
                  className="px-1.5 py-0.5 border border-[var(--border-subtle)] text-[var(--text-subtle)] uppercase"
                >
                  {tag}
                </span>
              ))}
              {task.metadata.tags.length > 2 && (
                <span className="px-1.5 py-0.5 text-[var(--border-subtle)]">
                  +{task.metadata.tags.length - 2}
                </span>
              )}
            </>
          )}
        </div>

        {/* Dependency indicators */}
        {task.metadata?.depends_on && task.metadata.depends_on.length > 0 && (
          <div className="text-[10px] text-[var(--accent-orange)] font-mono uppercase border-l-2 border-[var(--accent-orange)] pl-2">
            DEPENDS ON {task.metadata.depends_on.length}
          </div>
        )}
        {task.metadata?.blocked_by && task.metadata.blocked_by.length > 0 && (
          <div className="text-[10px] text-[var(--accent-orange)] font-mono uppercase border-l-2 border-[var(--accent-orange)] pl-2 animate-pulse">
            BLOCKED BY {task.metadata.blocked_by.length}
          </div>
        )}
        {task.metadata?.related_to && task.metadata.related_to.length > 0 && (
          <div className="text-[10px] text-[var(--text-dim)] font-mono uppercase border-l-2 border-[var(--text-dim)] pl-2">
            RELATED TO {task.metadata.related_to.length}
          </div>
        )}

        {/* Notes preview (first line only) */}
        {task.metadata?.notes && task.metadata.notes.length > 0 && (
          <div className="text-[10px] text-[var(--text-subtle)] font-mono italic border-t border-[var(--border-faint)] pt-2">
            {task.metadata.notes[0].substring(0, 60)}
            {task.metadata.notes[0].length > 60 ? '...' : ''}
            {task.metadata.notes.length > 1 && (
              <span className="text-[var(--border-subtle)] ml-1">[+{task.metadata.notes.length - 1}]</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

TaskNode.displayName = 'TaskNode';

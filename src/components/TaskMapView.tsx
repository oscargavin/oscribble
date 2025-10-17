import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Panel,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { TaskNode as TaskNodeType } from '../types';
import { TaskNode } from './TaskNode';

interface TaskMapViewProps {
  tasks: TaskNodeType[];
  onUpdate: (tasks: TaskNodeType[]) => void;
  projectRoot: string;
  projectName: string;
}

// Dagre layout configuration
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 320;
  const nodeHeight = 120;

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

export const TaskMapView: React.FC<TaskMapViewProps> = ({
  tasks,
  onUpdate,
  projectRoot,
  projectName,
}) => {
  // Convert tasks to React Flow nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Flatten tasks for easier processing
    const flattenTasks = (taskList: TaskNodeType[]): TaskNodeType[] => {
      const result: TaskNodeType[] = [];
      for (const task of taskList) {
        result.push(task);
        if (task.children.length > 0) {
          result.push(...flattenTasks(task.children));
        }
        if (task.subtasks && task.subtasks.length > 0) {
          result.push(...flattenTasks(task.subtasks));
        }
      }
      return result;
    };

    const flatTasks = flattenTasks(tasks);

    // Find all task IDs that are referenced in dependencies
    const referencedTaskIds = new Set<string>();
    flatTasks.forEach((task) => {
      if (!task.checked) {
        // Only consider dependencies from uncompleted tasks
        task.metadata?.depends_on?.forEach((id) => referencedTaskIds.add(id));
        task.metadata?.blocked_by?.forEach((id) => referencedTaskIds.add(id));
        task.metadata?.related_to?.forEach((id) => referencedTaskIds.add(id));
      }
    });

    // Filter tasks: include uncompleted tasks OR completed tasks that are referenced
    const visibleTasks = flatTasks.filter(
      (task) => !task.checked || referencedTaskIds.has(task.id)
    );

    // Create nodes
    visibleTasks.forEach((task) => {
      nodes.push({
        id: task.id,
        type: 'taskNode',
        data: {
          task,
          onUpdate,
          projectRoot,
          projectName,
        },
        position: { x: 0, y: 0 }, // Will be set by dagre
      });
    });

    // Create edges from dependencies (only for visible tasks)
    visibleTasks.forEach((task) => {
      // depends_on relationships
      if (task.metadata?.depends_on && task.metadata.depends_on.length > 0) {
        task.metadata.depends_on.forEach((dependencyId) => {
          edges.push({
            id: `${dependencyId}-${task.id}`,
            source: dependencyId,
            target: task.id,
            type: 'step',
            animated: false,
            style: { stroke: 'var(--text-primary)', strokeWidth: 2 },
            label: 'depends',
            labelStyle: {
              fill: 'var(--text-secondary)',
              fontSize: 10,
              fontFamily: 'monospace',
            },
          });
        });
      }

      // blocked_by relationships (legacy)
      if (task.metadata?.blocked_by && task.metadata.blocked_by.length > 0) {
        task.metadata.blocked_by.forEach((blockerId) => {
          edges.push({
            id: `${blockerId}-${task.id}-blocked`,
            source: blockerId,
            target: task.id,
            type: 'step',
            animated: true,
            style: { stroke: 'var(--text-primary)', strokeWidth: 2, strokeDasharray: '5,5' },
            label: 'blocks',
            labelStyle: {
              fill: 'var(--text-primary)',
              fontSize: 10,
              fontFamily: 'monospace',
            },
          });
        });
      }

      // related_to relationships (lighter style)
      if (task.metadata?.related_to && task.metadata.related_to.length > 0) {
        task.metadata.related_to.forEach((relatedId) => {
          // Only create edge if we haven't already created the reverse
          const reverseEdgeExists = edges.some(
            (e) => e.source === relatedId && e.target === task.id
          );
          if (!reverseEdgeExists) {
            edges.push({
              id: `${task.id}-${relatedId}-related`,
              source: task.id,
              target: relatedId,
              type: 'step',
              animated: false,
              style: { stroke: 'var(--text-primary)', strokeWidth: 1, strokeDasharray: '3,3' },
              label: 'related',
              labelStyle: {
                fill: 'var(--text-secondary)',
                fontSize: 10,
                fontFamily: 'monospace',
              },
            });
          }
        });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [tasks, onUpdate, projectRoot, projectName]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Custom node types
  const nodeTypes = useMemo(
    () => ({
      taskNode: TaskNode,
    }),
    []
  );

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    },
    [nodes, edges, setNodes, setEdges]
  );

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm font-mono uppercase tracking-wider">
        [NO TASKS] USE FORMAT TO GENERATE
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[var(--bg-primary)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'step',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border-primary)" gap={20} size={1} />
        <Controls className="bg-[var(--bg-primary)] border border-[var(--border-accent)]" />
        <Panel position="top-right" className="bg-[var(--bg-primary)] border border-[var(--border-accent)] p-2">
          <div className="flex gap-2">
            <button
              onClick={() => onLayout('TB')}
              className="px-3 py-1.5 text-xs font-mono border border-[var(--text-primary)] text-[var(--text-primary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] transition-colors uppercase"
            >
              VERTICAL
            </button>
            <button
              onClick={() => onLayout('LR')}
              className="px-3 py-1.5 text-xs font-mono border border-[var(--text-primary)] text-[var(--text-primary)] hover:border-[var(--accent-orange)] hover:text-[var(--accent-orange)] transition-colors uppercase"
            >
              HORIZONTAL
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

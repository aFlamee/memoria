import type {
	GraphEdgePayload,
	GraphNodePayload,
	SessionDetail,
	TaskGraphPayload
} from '$lib/types/observegraph';

export type TaskRootSummary = {
	taskId: string;
	title: string;
	status: string;
	rootNode: GraphNodePayload | null;
	nodeCount: number;
	edgeCount: number;
	actionCount: number;
};

export type SessionGraphIndex = {
	combinedGraph: TaskGraphPayload;
	taskMap: Map<string, TaskGraphPayload>;
	nodeMap: Map<string, GraphNodePayload>;
	edgeMap: Map<string, GraphEdgePayload>;
	nodeToTaskId: Map<string, string>;
	edgeToTaskId: Map<string, string>;
	taskNodeIds: Map<string, string[]>;
	taskEdgeIds: Map<string, string[]>;
	taskRoots: TaskRootSummary[];
	taskRootById: Map<string, TaskRootSummary>;
};

export function formatDuration(durationMs: number) {
	const minutes = Math.floor(durationMs / 60000);
	const seconds = Math.floor((durationMs % 60000) / 1000);

	if (minutes <= 0) {
		return `${seconds}s`;
	}

	return `${minutes}m ${seconds}s`;
}

export function truncateLabel(value: string, maxLength = 64) {
	const normalized = value.replace(/\s+/g, ' ').trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function getTaskRootNode(task: TaskGraphPayload): GraphNodePayload | null {
	if (task.nodes.length === 0) {
		return null;
	}

	const entryNode = task.nodes.find((node) => node.tone === 'entry');
	if (entryNode) {
		return entryNode;
	}

	const incomingTargets = new Set(task.edges.map((edge) => edge.target));
	const sourceOnlyNode = task.nodes.find((node) => !incomingTargets.has(node.id));
	if (sourceOnlyNode) {
		return sourceOnlyNode;
	}

	return task.nodes[0];
}

export function combineSessionTasks(session: SessionDetail): TaskGraphPayload {
	return {
		taskId: session.sessionId,
		title: session.displayName,
		status: session.status,
		durationMs: session.durationMs,
		totalTokens: session.totalTokens,
		totalTokensLabel: session.totalTokensLabel,
		totalCostUsd: session.totalCostUsd,
		totalCostUsdLabel: session.totalCostUsdLabel,
		actionCount: session.actionCount,
		nodes: session.tasks.flatMap((task) => task.nodes),
		edges: session.tasks.flatMap((task) => task.edges)
	};
}

export function buildSessionGraphIndex(session: SessionDetail): SessionGraphIndex {
	const combinedGraph = combineSessionTasks(session);
	const taskMap = new Map<string, TaskGraphPayload>();
	const nodeMap = new Map<string, GraphNodePayload>();
	const edgeMap = new Map<string, GraphEdgePayload>();
	const nodeToTaskId = new Map<string, string>();
	const edgeToTaskId = new Map<string, string>();
	const taskNodeIds = new Map<string, string[]>();
	const taskEdgeIds = new Map<string, string[]>();

	const taskRoots = session.tasks.map((task) => {
		taskMap.set(task.taskId, task);
		taskNodeIds.set(
			task.taskId,
			task.nodes.map((node) => node.id)
		);
		taskEdgeIds.set(
			task.taskId,
			task.edges.map((edge) => edge.id)
		);

		for (const node of task.nodes) {
			nodeMap.set(node.id, node);
			nodeToTaskId.set(node.id, task.taskId);
		}

		for (const edge of task.edges) {
			edgeMap.set(edge.id, edge);
			edgeToTaskId.set(edge.id, task.taskId);
		}

		return {
			taskId: task.taskId,
			title: task.title,
			status: task.status,
			rootNode: getTaskRootNode(task),
			nodeCount: task.nodes.length,
			edgeCount: task.edges.length,
			actionCount: task.actionCount
		};
	});

	return {
		combinedGraph,
		taskMap,
		nodeMap,
		edgeMap,
		nodeToTaskId,
		edgeToTaskId,
		taskNodeIds,
		taskEdgeIds,
		taskRoots,
		taskRootById: new Map(taskRoots.map((taskRoot) => [taskRoot.taskId, taskRoot]))
	};
}

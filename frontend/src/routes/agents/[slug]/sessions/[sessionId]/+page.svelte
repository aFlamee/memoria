<script lang="ts">
	import { onMount } from 'svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import SessionGraphExplorer from '$lib/components/SessionGraphExplorer.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { AgentSessionDetail } from '$lib/types/observegraph';
	import { buildSessionGraphIndex, formatDuration } from '$lib/utils/observegraph';

	let { data }: { data: { sessionView: AgentSessionDetail | null } } = $props();

	let sidebarState = $state<'closed' | 'detail'>('closed');
	let activeTaskId = $state<string | null>(null);
	let selectedNodeId = $state<string | null>(null);
	let selectedEdgeId = $state<string | null>(null);
	let focusRevision = $state(0);
	let sessionChromeHeight = $state(0);
	let focusRevisionCounter = 0;
	let lastSessionId: string | null = null;
	let chromeElement = $state<HTMLDivElement | null>(null);

	const graphIndex = $derived(
		data.sessionView ? buildSessionGraphIndex(data.sessionView.session) : null
	);
	const activeTask = $derived(
		graphIndex && activeTaskId ? (graphIndex.taskMap.get(activeTaskId) ?? null) : null
	);
	const activeTaskRoot = $derived(
		graphIndex && activeTaskId ? (graphIndex.taskRootById.get(activeTaskId) ?? null) : null
	);
	const selectedNode = $derived(
		graphIndex && selectedNodeId ? (graphIndex.nodeMap.get(selectedNodeId) ?? null) : null
	);
	const selectedEdge = $derived(
		graphIndex && selectedEdgeId ? (graphIndex.edgeMap.get(selectedEdgeId) ?? null) : null
	);
	const selectedAction = $derived(selectedNode ?? activeTaskRoot?.rootNode ?? null);
	const activeNodeIds = $derived(
		graphIndex && activeTaskId ? (graphIndex.taskNodeIds.get(activeTaskId) ?? []) : []
	);
	const activeEdgeIds = $derived(
		graphIndex && activeTaskId ? (graphIndex.taskEdgeIds.get(activeTaskId) ?? []) : []
	);
	const focusRootNodeId = $derived(activeTaskRoot?.rootNode?.id ?? null);
	const viewportMode = $derived(activeTaskId ? 'task' : 'graph');

	onMount(() => {
		document.documentElement.classList.add('session-workspace-active');
		document.body.classList.add('session-workspace-active');

		return () => {
			document.documentElement.classList.remove('session-workspace-active');
			document.body.classList.remove('session-workspace-active');
		};
	});

	$effect(() => {
		if (!chromeElement || typeof ResizeObserver === 'undefined') {
			return;
		}

		const updateChromeHeight = () => {
			sessionChromeHeight = Math.ceil(chromeElement?.getBoundingClientRect().height ?? 0);
		};

		updateChromeHeight();

		const observer = new ResizeObserver(() => {
			updateChromeHeight();
		});

		observer.observe(chromeElement);

		return () => {
			observer.disconnect();
		};
	});

	function bumpFocusRevision() {
		focusRevisionCounter += 1;
		focusRevision = focusRevisionCounter;
	}

	$effect(() => {
		const sessionId = data.sessionView?.session.sessionId ?? null;
		if (!sessionId || sessionId === lastSessionId) {
			return;
		}

		lastSessionId = sessionId;
		sidebarState = 'closed';
		activeTaskId = null;
		selectedNodeId = null;
		selectedEdgeId = null;
		bumpFocusRevision();
	});

	function openTask(
		taskId: string,
		options?: { selectedNodeId?: string | null; recenter?: boolean }
	) {
		if (!graphIndex) {
			return;
		}

		const root = graphIndex.taskRootById.get(taskId)?.rootNode ?? null;

		activeTaskId = taskId;
		selectedNodeId = options?.selectedNodeId ?? root?.id ?? null;
		selectedEdgeId = null;
		sidebarState = 'detail';

		if (options?.recenter ?? true) {
			bumpFocusRevision();
		}
	}

	function resetFocus() {
		sidebarState = 'closed';
		activeTaskId = null;
		selectedNodeId = null;
		selectedEdgeId = null;
		bumpFocusRevision();
	}

	function handleNodeSelect(nodeId: string) {
		if (!graphIndex) {
			return;
		}

		const taskId = graphIndex.nodeToTaskId.get(nodeId);
		if (!taskId) {
			return;
		}

		openTask(taskId, { selectedNodeId: nodeId, recenter: true });
	}

	function handleEdgeSelect(edgeId: string) {
		if (!graphIndex) {
			return;
		}

		const taskId = graphIndex.edgeToTaskId.get(edgeId);
		if (!taskId) {
			return;
		}

		const shouldRecenter = taskId !== activeTaskId || sidebarState !== 'detail';
		const rootNodeId = graphIndex.taskRootById.get(taskId)?.rootNode?.id ?? null;

		activeTaskId = taskId;
		selectedNodeId = rootNodeId;
		selectedEdgeId = edgeId;
		sidebarState = 'detail';

		if (shouldRecenter) {
			bumpFocusRevision();
		}
	}

	function selectSidebarEdge(edgeId: string) {
		handleEdgeSelect(edgeId);
	}

	function formatRisk(riskScore: number) {
		return `${Math.round(riskScore * 100)}%`;
	}

	function formatSuccessRate(successRate: number) {
		return `${Math.round(successRate * 100)}%`;
	}
</script>

{#if data.sessionView && graphIndex}
	<div class="session-workspace" style={`--session-chrome-height: ${sessionChromeHeight}px;`}>
		<div class="session-workspace__graph-surface">
			{#key data.sessionView.session.sessionId}
				<SessionGraphExplorer
					graph={graphIndex.combinedGraph}
					{activeNodeIds}
					{activeEdgeIds}
					{selectedNodeId}
					{selectedEdgeId}
					{focusRootNodeId}
					{viewportMode}
					viewportNodeIds={activeNodeIds}
					viewportEdgeIds={activeEdgeIds}
					{focusRevision}
					onNodeSelect={handleNodeSelect}
					onEdgeSelect={handleEdgeSelect}
					onCanvasReset={resetFocus}
				/>
			{/key}
		</div>

		<div class="session-workspace__chrome" bind:this={chromeElement}>
			<div class="session-workspace__chrome-main">
				<a class="session-workspace__back" href="../../">Back</a>
				<div class="session-workspace__identity">
					<span class="session-workspace__tech-id">
						Run {data.sessionView.session.sessionShortId} · {data.sessionView.session.sessionId}
					</span>
					<h1>{data.sessionView.session.displayName}</h1>
					{#if data.sessionView.session.displaySubtitle}
						<p>{data.sessionView.session.displaySubtitle}</p>
					{/if}
				</div>
			</div>

			<div class="session-workspace__chrome-meta">
				<StatusBadge status={data.sessionView.instance.status} />
				<span>{data.sessionView.session.status}</span>
				<span>{formatDuration(data.sessionView.session.durationMs)}</span>
				<span>{data.sessionView.session.totalCostUsdLabel}</span>
				{#if sidebarState === 'detail'}
					<button type="button" class="session-workspace__toolbar-button" onclick={resetFocus}>
						Close panel
					</button>
				{/if}
			</div>
		</div>

		<aside
			class={`session-workspace__sidebar ${sidebarState === 'detail' && activeTask && activeTaskRoot ? 'session-workspace__sidebar--open' : ''}`}
		>
			{#if sidebarState === 'detail' && activeTask && activeTaskRoot}
				<div class="session-sidebar__section">
					<div class="session-sidebar__detail-header">
						<div>
							<p class="session-workspace__eyeline">Focused task</p>
							<h3>{activeTask.title}</h3>
						</div>
						<button type="button" class="session-sidebar__close" onclick={resetFocus}>
							Close
						</button>
					</div>

					<div class="session-sidebar__detail-card">
						<div class="session-sidebar__item-top">
							<strong>Root node</strong>
							<span>{activeTask.status}</span>
						</div>
						<p>{activeTaskRoot.rootNode?.label ?? 'No root node'}</p>
						<div class="session-sidebar__meta">
							<span>{activeTask.actionCount} actions</span>
							<span>{formatDuration(activeTask.durationMs)}</span>
							<span>{activeTask.totalCostUsdLabel}</span>
						</div>
					</div>

					{#if selectedAction}
						<div class="session-sidebar__detail-card">
							<div class="session-sidebar__item-top">
								<strong>Action</strong>
								<span>{selectedAction.status}</span>
							</div>
							<p>{selectedAction.label}</p>
							<div class="session-sidebar__meta">
								<span>{selectedAction.toolName}</span>
								<span>{selectedAction.totalTokens} tok</span>
								<span>{selectedAction.durationMs}ms</span>
								{#if selectedAction.riskScore > 0}
									<span>risk {formatRisk(selectedAction.riskScore)}</span>
								{/if}
							</div>
						</div>
					{/if}

					<div class="session-sidebar__section session-sidebar__section--flush">
						<div class="panel-heading">
							<h3>Edges</h3>
						</div>

						<div class="session-sidebar__stack">
							{#if activeTask.edges.length > 0}
								{#each activeTask.edges as edge (edge.id)}
									<button
										type="button"
										class={`session-sidebar__item ${selectedEdgeId === edge.id ? 'session-sidebar__item--active' : ''}`}
										onclick={() => selectSidebarEdge(edge.id)}
									>
										<div class="session-sidebar__item-top">
											<strong>{edge.sourceLabel}</strong>
											<span>{formatSuccessRate(edge.successRate)}</span>
										</div>
										<p>{edge.targetLabel}</p>
										<div class="session-sidebar__meta">
											<span>{edge.totalTokens} tok</span>
											<span>{edge.avgLatencyMs}ms</span>
										</div>
									</button>
								{/each}
							{:else}
								<div class="session-sidebar__empty">
									<p>No edges recorded for this task.</p>
								</div>
							{/if}
						</div>
					</div>

					{#if selectedEdge}
						<div class="session-sidebar__detail-card">
							<div class="session-sidebar__item-top">
								<strong>Selected edge</strong>
								<span>{formatSuccessRate(selectedEdge.successRate)}</span>
							</div>
							<p>{selectedEdge.sourceLabel} -> {selectedEdge.targetLabel}</p>
							<div class="session-sidebar__meta">
								<span>{selectedEdge.traversalCount} traversal</span>
								<span>{selectedEdge.totalTokens} tok</span>
								<span>{selectedEdge.avgLatencyMs}ms</span>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</aside>
	</div>
{:else}
	<PageShell title="Not found" description="Pick a valid session.">
		<section class="empty-state">
			<p>This session is not in the current dataset.</p>
			<a class="empty-state__link" href="../../">Back to session index</a>
		</section>
	</PageShell>
{/if}

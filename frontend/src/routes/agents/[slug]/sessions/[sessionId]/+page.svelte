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

	// ── Left panel filter state ─────────────────────────────
	let filterStatus = $state<'all' | 'completed' | 'failed'>('all');
	let filterType = $state<'all' | 'code' | 'shell'>('all');
	let filterTokenBucket = $state<'all' | 'low' | 'mid' | 'high'>('all');

	const allTasks = $derived(data.sessionView?.session.tasks ?? []);

	const filteredTasks = $derived(allTasks.filter((t) => {
		if (filterStatus !== 'all' && t.status !== filterStatus) return false;
		if (filterType !== 'all') {
			const hasType = t.nodes.some((n) => {
				if (filterType === 'shell') return n.toolName === 'bash';
				if (filterType === 'code') return n.toolName === 'read_file' || n.toolName === 'write_file' || n.toolName === 'grep';
				return true;
			});
			if (!hasType) return false;
		}
		if (filterTokenBucket !== 'all') {
			if (filterTokenBucket === 'low' && t.totalTokens >= 2000) return false;
			if (filterTokenBucket === 'mid' && (t.totalTokens < 2000 || t.totalTokens >= 8000)) return false;
			if (filterTokenBucket === 'high' && t.totalTokens < 8000) return false;
		}
		return true;
	}));

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

	function formatTimestamp(iso: string | null) {
		if (!iso) return '—';
		const d = new Date(iso);
		return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function formatDate(iso: string | null) {
		if (!iso) return '—';
		const d = new Date(iso);
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	const TOOL_LABELS: Record<string, string> = {
		read_file: '📄 read_file',
		write_file: '✏️ write_file',
		bash: '$ bash',
		grep: '🔍 grep',
		list_dir: '📁 list_dir',
		api_call: '🌐 api_call',
		web_search: '🔎 web_search'
	};

	function toolLabel(toolName: string) {
		return TOOL_LABELS[toolName] ?? toolName;
	}
</script>

{#if data.sessionView && graphIndex}
	<div
		class="session-workspace"
		style={`--session-chrome-height: ${sessionChromeHeight}px;`}
	>
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

		<!-- Left filter + task list panel -->
		<nav class="task-filter-panel">
			<div class="task-filter-panel__heading">
				<span class="task-filter-panel__label">Tasks</span>
				<span class="task-filter-panel__count">{filteredTasks.length} / {allTasks.length}</span>
			</div>

			<div class="task-filter-panel__filters">
				<div class="task-filter-panel__filter-group">
					<span class="task-filter-panel__filter-label">Status</span>
					<div class="task-filter-panel__chips">
						{#each (['all', 'completed', 'failed'] as const) as opt}
							<button
								type="button"
								class={`task-filter-chip ${filterStatus === opt ? 'task-filter-chip--active' : ''}`}
								onclick={() => { filterStatus = opt; }}
							>{opt}</button>
						{/each}
					</div>
				</div>

				<div class="task-filter-panel__filter-group">
					<span class="task-filter-panel__filter-label">Type</span>
					<div class="task-filter-panel__chips">
						{#each (['all', 'code', 'shell'] as const) as opt}
							<button
								type="button"
								class={`task-filter-chip ${filterType === opt ? 'task-filter-chip--active' : ''}`}
								onclick={() => { filterType = opt; }}
							>{opt}</button>
						{/each}
					</div>
				</div>

				<div class="task-filter-panel__filter-group">
					<span class="task-filter-panel__filter-label">Tokens</span>
					<div class="task-filter-panel__chips">
						{#each (['all', 'low', 'mid', 'high'] as const) as opt}
							<button
								type="button"
								class={`task-filter-chip ${filterTokenBucket === opt ? 'task-filter-chip--active' : ''}`}
								onclick={() => { filterTokenBucket = opt; }}
							>{opt === 'low' ? '<2k' : opt === 'mid' ? '2–8k' : opt === 'high' ? '>8k' : opt}</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="task-filter-panel__list">
				{#if filteredTasks.length === 0}
					<div class="task-filter-panel__empty">No tasks match the current filters.</div>
				{/if}
				{#each filteredTasks as task (task.taskId)}
					<button
						type="button"
						class={`task-filter-item ${activeTaskId === task.taskId ? 'task-filter-item--active' : ''}`}
						onclick={() => openTask(task.taskId)}
					>
						<div class="task-filter-item__top">
							<span class="task-filter-item__title">{task.title}</span>
							<span class="session-sidebar__status-pill session-sidebar__status-pill--{task.status}">{task.status}</span>
						</div>
						<div class="task-filter-item__meta">
							<span>{task.actionCount} actions</span>
							<span>{task.totalTokensLabel} tok</span>
							<span>{formatDuration(task.durationMs)}</span>
						</div>
						<div class="task-filter-item__cost">{task.totalCostUsdLabel}</div>
					</button>
				{/each}
			</div>
		</nav>

		<div class="session-workspace__chrome" bind:this={chromeElement}>
			<div class="session-workspace__chrome-main">
				<a class="session-workspace__back" href="../../">Back</a>
				<div class="session-workspace__identity">
					<h1>{data.sessionView.session.sessionId}</h1>
					<p>
						{data.sessionView.instance.name} · {data.sessionView.instance.environment} · {data
							.sessionView.session.gitBranch}
					</p>
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

					<!-- Task header -->
					<div class="session-sidebar__detail-header">
						<div class="session-sidebar__task-id">
							<h3>{activeTask.title}</h3>
							<div class="session-sidebar__meta" style="margin-top:0.3rem">
								<span>{activeTask.actionCount} actions</span>
								<span>{formatDuration(activeTask.durationMs)}</span>
								<span>{activeTask.totalCostUsdLabel}</span>
								<span class="session-sidebar__status-pill session-sidebar__status-pill--{activeTask.status}">{activeTask.status}</span>
							</div>
						</div>
						<button type="button" class="session-sidebar__close" onclick={resetFocus}>✕</button>
					</div>

					<!-- Action detail -->
					{#if selectedNode}
						<div class="action-detail">
							<div class="action-detail__header">
								<span class="action-detail__tool-badge action-detail__tool-badge--{selectedNode.toolName}">{toolLabel(selectedNode.toolName)}</span>
								<span class="session-sidebar__status-pill session-sidebar__status-pill--{selectedNode.status}">{selectedNode.status}</span>
							</div>

							<h4 class="action-detail__name">{selectedNode.label}</h4>

							<div class="action-detail__meta-grid">
								<div class="action-detail__meta-cell">
									<span>Date</span>
									<strong>{formatDate(selectedNode.startedAt)}</strong>
								</div>
								<div class="action-detail__meta-cell">
									<span>Time</span>
									<strong>{formatTimestamp(selectedNode.startedAt)}</strong>
								</div>
								<div class="action-detail__meta-cell">
									<span>Duration</span>
									<strong>{selectedNode.durationMs}ms</strong>
								</div>
								<div class="action-detail__meta-cell">
									<span>Tokens</span>
									<strong>{selectedNode.totalTokens}</strong>
								</div>
								<div class="action-detail__meta-cell">
									<span>Cost</span>
									<strong>${selectedNode.costUsd.toFixed(4)}</strong>
								</div>
								<div class="action-detail__meta-cell">
									<span>Permission</span>
									<strong>{selectedNode.permissionLevel}</strong>
								</div>
								{#if selectedNode.riskScore > 0}
									<div class="action-detail__meta-cell action-detail__meta-cell--risk">
										<span>Risk</span>
										<strong>{formatRisk(selectedNode.riskScore)}</strong>
									</div>
								{/if}
								{#if selectedNode.modelUsed}
									<div class="action-detail__meta-cell action-detail__meta-cell--wide">
										<span>Model</span>
										<strong>{selectedNode.modelUsed}</strong>
									</div>
								{/if}
							</div>

							{#if selectedNode.reasoning}
								<div class="action-detail__section">
									<span class="action-detail__label">Reasoning</span>
									<p class="action-detail__reasoning">{selectedNode.reasoning}</p>
								</div>
							{/if}

							{#if selectedNode.filePath}
								<div class="action-detail__section">
									<span class="action-detail__label">File</span>
									<code class="action-detail__filepath">{selectedNode.filePath}</code>
								</div>
							{/if}

							{#if selectedNode.command}
								<div class="action-detail__section">
									<span class="action-detail__label">stdin</span>
									<pre class="action-detail__code">{selectedNode.command}</pre>
								</div>
							{/if}

							{#if selectedNode.stdout}
								<div class="action-detail__section">
									<span class="action-detail__label">stdout</span>
									<pre class="action-detail__code">{selectedNode.stdout}</pre>
								</div>
							{/if}

							{#if selectedNode.stderr}
								<div class="action-detail__section">
									<span class="action-detail__label">stderr</span>
									<pre class="action-detail__code action-detail__code--error">{selectedNode.stderr}</pre>
								</div>
							{/if}

							{#if selectedNode.exitCode !== null && selectedNode.exitCode !== undefined}
								<div class="action-detail__section">
									<span class="action-detail__label">Exit code</span>
									<code class="action-detail__filepath">{selectedNode.exitCode}</code>
								</div>
							{/if}
						</div>
					{:else}
						<div class="session-sidebar__detail-card">
							<p class="action-detail__hint">Click a node in the graph to inspect it.</p>
						</div>
					{/if}

					<!-- Edge list -->
					<div class="session-sidebar__section session-sidebar__section--flush">
						<div class="panel-heading">
							<h3>Path edges</h3>
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
										<p>→ {edge.targetLabel}</p>
										<div class="session-sidebar__meta">
											<span>{edge.totalTokens} tok</span>
											<span>{edge.avgLatencyMs}ms avg</span>
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

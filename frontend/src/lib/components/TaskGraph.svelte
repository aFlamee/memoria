<script lang="ts">
	import { onMount } from 'svelte';
	import type { Core, ElementDefinition } from 'cytoscape';
	import type { TaskGraphPayload } from '$lib/types/observegraph';

	let { graph }: { graph: TaskGraphPayload } = $props();

	let container: HTMLDivElement;
	let selectedId = $state<string | null>(null);

	const selectedNode = $derived(
		selectedId ? (graph.nodes.find((node) => node.id === selectedId) ?? null) : null
	);
	const selectedEdge = $derived(
		selectedId ? (graph.edges.find((edge) => edge.id === selectedId) ?? null) : null
	);

	onMount(() => {
		let cy: Core | undefined;

		const initialize = async () => {
			const [{ default: cytoscape }, { default: dagrePlugin }] = await Promise.all([
				import('cytoscape'),
				import('cytoscape-dagre')
			]);

			cytoscape.use(dagrePlugin);

			const elements: ElementDefinition[] = [
				...graph.nodes.map((node) => ({
					data: {
						id: node.id,
						label: node.label,
						runCount: node.runCount,
						successRate: node.successRate,
						avgTokens: node.avgTokens,
						avgLatencyMs: node.avgLatencyMs,
						tone: node.tone
					}
				})),
				...graph.edges.map((edge) => ({
					data: {
						id: edge.id,
						source: edge.source,
						target: edge.target,
						runCount: edge.runCount,
						successRate: edge.successRate,
						avgTokens: edge.avgTokens,
						avgLatencyMs: edge.avgLatencyMs
					}
				}))
			];

			cy = cytoscape({
				container,
				elements,
				layout: {
					name: 'dagre',
					rankDir: 'LR',
					nodeSep: 44,
					rankSep: 92,
					padding: 20
				} as any,
				style: [
					{
						selector: 'node',
						style: {
							label: 'data(label)',
							'font-family': 'var(--font-body)',
							'font-size': '11px',
							'text-wrap': 'wrap',
							'text-max-width': '100px',
							'text-valign': 'center',
							'text-halign': 'center',
							color: '#111111',
							'background-color': '#ece4d1',
							'border-width': 2,
							'border-color': '#111111',
							width: 'mapData(avgTokens, 80, 2200, 74, 124)',
							height: 'mapData(avgTokens, 80, 2200, 46, 86)',
							shape: 'round-rectangle'
						}
					},
					{ selector: 'node[tone = "entry"]', style: { 'background-color': '#d88d28' } },
					{
						selector: 'node[tone = "exit"]',
						style: { 'background-color': '#2b8d73', color: '#f8f4eb' }
					},
					{
						selector: 'node[tone = "risk"]',
						style: { 'background-color': '#c84d35', color: '#fff7f1' }
					},
					{
						selector: 'edge',
						style: {
							width: 'mapData(runCount, 1, 8, 1, 6)',
							'curve-style': 'bezier',
							'target-arrow-shape': 'triangle',
							'line-color': '#313131',
							'target-arrow-color': '#313131',
							opacity: 0.84
						}
					}
				] as any
			});

			cy.on('tap', 'node', (event) => {
				selectedId = event.target.id();
			});
			cy.on('tap', 'edge', (event) => {
				selectedId = event.target.id();
			});
			cy.on('tap', (event) => {
				if (event.target === cy) selectedId = null;
			});
			cy.fit(undefined, 28);
		};

		void initialize();

		return () => cy?.destroy();
	});
</script>

<section class="task-graph">
	<div class="task-graph__header">
		<div>
			<h3>{graph.title}</h3>
			<p>{graph.runCount} runs · {Math.round(graph.successRate * 100)}%</p>
		</div>
	</div>

	<div class="task-graph__layout">
		<div bind:this={container} class="task-graph__canvas" aria-label={`${graph.title} DAG`}></div>

		<aside class="task-graph__inspector">
			{#if selectedNode}
				<p class="task-graph__inspector-title">{selectedNode.label}</p>
				<ul>
					<li>Tool: {selectedNode.toolName}</li>
					<li>Runs: {selectedNode.runCount}</li>
					<li>Success: {Math.round(selectedNode.successRate * 100)}%</li>
					<li>Avg tokens: {selectedNode.avgTokens}</li>
					<li>Avg latency: {selectedNode.avgLatencyMs}ms</li>
				</ul>
			{:else if selectedEdge}
				<p class="task-graph__inspector-title">Edge metrics</p>
				<ul>
					<li>Traversals: {selectedEdge.runCount}</li>
					<li>Success: {Math.round(selectedEdge.successRate * 100)}%</li>
					<li>Avg tokens: {selectedEdge.avgTokens}</li>
					<li>Avg latency: {selectedEdge.avgLatencyMs}ms</li>
				</ul>
			{:else}
				<p class="task-graph__inspector-title">Inspect</p>
				<p>Tap a node.</p>
			{/if}
		</aside>
	</div>
</section>

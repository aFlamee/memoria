<script lang="ts">
	import { scale } from 'svelte/transition';
	import { onMount } from 'svelte';
	import type { Core, EdgeSingular, NodeSingular, ElementDefinition } from 'cytoscape';
	import type {
		GraphEdgePayload,
		GraphNodePayload,
		TaskGraphPayload
	} from '$lib/types/observegraph';

	let { graph }: { graph: TaskGraphPayload } = $props();

	let container: HTMLDivElement;
	let cy: Core | undefined;
	let selectedEdgeId = $state<string | null>(null);
	let selectedNodeId = $state<string | null>(null);
	let edgePopover = $state<{ edge: GraphEdgePayload; x: number; y: number } | null>(null);
	let nodePopover = $state<{ node: GraphNodePayload; x: number; y: number } | null>(null);

	function updatePopoverPositions() {
		if (!cy) {
			edgePopover = null;
			nodePopover = null;
			return;
		}

		if (selectedEdgeId) {
			const edge = cy.getElementById(selectedEdgeId) as EdgeSingular;
			const payload = graph.edges.find((item) => item.id === selectedEdgeId);
			if (!payload || edge.empty()) {
				edgePopover = null;
			} else {
				const midpoint = edge.renderedMidpoint();
				edgePopover = { edge: payload, x: midpoint.x, y: midpoint.y - 18 };
			}
		} else {
			edgePopover = null;
		}

		if (selectedNodeId) {
			const node = cy.getElementById(selectedNodeId) as NodeSingular;
			const payload = graph.nodes.find((item) => item.id === selectedNodeId);
			if (!payload || node.empty()) {
				nodePopover = null;
			} else {
				const pos = node.renderedPosition();
				nodePopover = { node: payload, x: pos.x, y: pos.y - 14 };
			}
		} else {
			nodePopover = null;
		}
	}

	function clearSelection() {
		selectedEdgeId = null;
		selectedNodeId = null;
		cy?.elements().unselect();
		updatePopoverPositions();
	}

	function applyFocusNodeColors() {
		if (!cy) return;

		const nodes = cy.nodes();
		if (nodes.empty()) return;

		nodes.removeClass('graph-node--focus');
		nodes.addClass('graph-node--outer');

		const focusNode = nodes.toArray().reduce((currentFocus, candidate) => {
			return candidate.connectedEdges().length > currentFocus.connectedEdges().length
				? candidate
				: currentFocus;
		}, nodes[0]);

		focusNode.removeClass('graph-node--outer');
		focusNode.addClass('graph-node--focus');
	}

	onMount(() => {
		let isUnmounted = false;

		const initialize = async () => {
			const { default: cytoscape } = await import('cytoscape');
			const { default: cytoscapeDagre } = await import('cytoscape-dagre');

			if (isUnmounted) return;

			cytoscape.use(cytoscapeDagre);

			const elements: ElementDefinition[] = [
				...graph.nodes.map((node) => ({
					classes: 'graph-node',
					data: {
						id: node.id,
						label: node.label,
						toolName: node.toolName,
						status: node.status,
						totalTokens: node.totalTokens,
						durationMs: node.durationMs,
						riskScore: node.riskScore,
						tone: node.tone
					}
				})),
				...graph.edges.map((edge) => ({
					data: {
						id: edge.id,
						source: edge.source,
						target: edge.target,
						label: edge.label,
						successRate: edge.successRate,
						totalTokens: edge.totalTokens,
						avgLatencyMs: edge.avgLatencyMs
					}
				}))
			];

			cy = cytoscape({
				container,
				elements,
				layout: {
					name: 'dagre',
					rankDir: 'TB',
					nodeSep: 30,
					rankSep: 45,
					edgeSep: 16,
					ranker: 'network-simplex',
					spacingFactor: 1.4,
					animate: false,
					padding: 14,
					fit: true
				} as never,
				userPanningEnabled: true,
				userZoomingEnabled: false,
				boxSelectionEnabled: false,
				autoungrabify: false,
				style: [
					{
						selector: 'node',
						style: {
							label: '',
							width: 'mapData(totalTokens, 64, 1200, 10, 22)',
							height: 'mapData(totalTokens, 64, 1200, 10, 22)',
							shape: 'ellipse',
							'background-color': 'rgba(140, 160, 220, 0.25)',
							'border-width': 1.5,
							'border-color': 'rgba(140, 165, 220, 0.6)',
							'overlay-opacity': 0,
							'transition-property': 'border-width, border-color, width, height',
							'transition-duration': '150ms'
						}
					},
					{
						selector: 'node.graph-node--outer',
						style: {
							'background-color': 'rgba(72, 194, 136, 0.34)',
							'border-color': 'rgba(72, 194, 136, 0.88)'
						}
					},
					{
						selector: 'node.graph-node--focus',
						style: {
							'background-color': 'rgba(28, 72, 168, 0.42)',
							'border-color': 'rgba(58, 118, 255, 0.92)',
							'border-width': 2.2
						}
					},
					{
						selector: 'node:active',
						style: {
							'overlay-opacity': 0,
							'border-width': 2.5,
							'border-color': 'rgba(255, 255, 255, 0.6)'
						}
					},
					{
						selector: 'node:selected',
						style: {
							'border-width': 2.5,
							'border-color': 'rgba(255, 255, 255, 0.8)',
							'overlay-opacity': 0
						}
					},
					{
						selector: 'edge',
						style: {
							width: 0.8,
							'curve-style': 'bezier',
							'line-color': 'rgba(130, 100, 210, 0.28)',
							'target-arrow-shape': 'triangle',
							'target-arrow-color': 'rgba(130, 100, 210, 0.32)',
							'arrow-scale': 0.4,
							opacity: 0.75
						}
					},
					{
						selector: 'edge:selected',
						style: {
							width: 1.4,
							'line-color': 'rgba(200, 140, 255, 0.75)',
							'target-arrow-color': 'rgba(200, 140, 255, 0.75)'
						}
					}
				] as never
			});

			applyFocusNodeColors();

			cy.on('tap', 'node', (event) => {
				selectedEdgeId = null;
				selectedNodeId = event.target.id();
				cy?.elements().unselect();
				event.target.select();
				updatePopoverPositions();
			});

			cy.on('tap', 'edge', (event) => {
				selectedNodeId = null;
				selectedEdgeId = event.target.id();
				cy?.elements().unselect();
				event.target.select();
				updatePopoverPositions();
			});

			cy.on('tap', (event) => {
				if (event.target === cy) clearSelection();
			});

			cy.on('pan zoom render dragfree position', updatePopoverPositions);
			cy.fit(undefined, 14);
		};

		void initialize();

		return () => {
			isUnmounted = true;
			cy?.destroy();
		};
	});
</script>

<div class="task-graph-mini">
	<div class="task-graph-mini__canvas-shell">
		<div
			bind:this={container}
			class="task-graph-mini__canvas"
			aria-label={`${graph.title} action graph`}
		></div>

		{#if nodePopover}
			<div
				class="task-graph-mini__popover"
				style={`left:${nodePopover.x}px; top:${nodePopover.y}px;`}
				transition:scale={{ duration: 160, start: 0.92 }}
			>
				<p class="task-graph-mini__popover-title">{nodePopover.node.label}</p>
				<p class="task-graph-mini__popover-sub">{nodePopover.node.toolName}</p>
				<div class="task-graph-mini__popover-metrics">
					<span>{nodePopover.node.status}</span>
					<span>{nodePopover.node.totalTokens} tok</span>
					<span>{nodePopover.node.durationMs}ms</span>
					{#if nodePopover.node.riskScore >= 0.1}
						<span>risk {Math.round(nodePopover.node.riskScore * 100)}%</span>
					{/if}
				</div>
			</div>
		{/if}

		{#if edgePopover}
			<div
				class="task-graph-mini__popover"
				style={`left:${edgePopover.x}px; top:${edgePopover.y}px;`}
				transition:scale={{ duration: 160, start: 0.92 }}
			>
				<p class="task-graph-mini__popover-title">{edgePopover.edge.sourceLabel}</p>
				<p class="task-graph-mini__popover-sub">{edgePopover.edge.targetLabel}</p>
				<div class="task-graph-mini__popover-metrics">
					<span>{Math.round(edgePopover.edge.successRate * 100)}%</span>
					<span>{edgePopover.edge.totalTokens} tok</span>
					<span>{edgePopover.edge.avgLatencyMs}ms</span>
				</div>
			</div>
		{/if}
	</div>
</div>

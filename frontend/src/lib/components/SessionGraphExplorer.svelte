<script lang="ts">
	import { onMount } from 'svelte';
	import type { Core, ElementDefinition, NodeSingular } from 'cytoscape';
	import type { TaskGraphPayload } from '$lib/types/observegraph';

	let {
		graph,
		activeNodeIds = [],
		activeEdgeIds = [],
		viewportMode = 'graph',
		viewportNodeIds = [],
		viewportEdgeIds = [],
		selectedNodeId = null,
		selectedEdgeId = null,
		focusRootNodeId = null,
		focusRevision = 0,
		onNodeSelect,
		onEdgeSelect,
		onCanvasReset
	}: {
		graph: TaskGraphPayload;
		activeNodeIds?: string[];
		activeEdgeIds?: string[];
		viewportMode?: 'graph' | 'task';
		viewportNodeIds?: string[];
		viewportEdgeIds?: string[];
		selectedNodeId?: string | null;
		selectedEdgeId?: string | null;
		focusRootNodeId?: string | null;
		focusRevision?: number;
		onNodeSelect?: (nodeId: string) => void;
		onEdgeSelect?: (edgeId: string) => void;
		onCanvasReset?: () => void;
	} = $props();

	let container: HTMLDivElement;
	let cy: Core | undefined;
	let isSyncingSelection = false;

	function syncGraphClasses({
		activeNodeIds,
		activeEdgeIds,
		selectedNodeId,
		selectedEdgeId,
		focusRootNodeId
	}: {
		activeNodeIds: string[];
		activeEdgeIds: string[];
		selectedNodeId: string | null;
		selectedEdgeId: string | null;
		focusRootNodeId: string | null;
	}) {
		if (!cy) {
			return;
		}

		const activeNodeIdsSet = new Set(activeNodeIds);
		const activeEdgeIdsSet = new Set(activeEdgeIds);
		const hasFocusedTask = activeNodeIds.length > 0;

		for (const node of cy.nodes()) {
			node.toggleClass('graph-node--muted', hasFocusedTask && !activeNodeIdsSet.has(node.id()));
			node.toggleClass('graph-node--root', focusRootNodeId === node.id());
		}

		for (const edge of cy.edges()) {
			edge.toggleClass('graph-edge--muted', hasFocusedTask && !activeEdgeIdsSet.has(edge.id()));
		}

		isSyncingSelection = true;
		try {
			cy.elements().unselect();

			if (selectedNodeId) {
				cy.getElementById(selectedNodeId).select();
			}

			if (selectedEdgeId) {
				cy.getElementById(selectedEdgeId).select();
			}
		} finally {
			isSyncingSelection = false;
		}
	}

	function syncViewport({
		viewportMode,
		viewportNodeIds,
		viewportEdgeIds,
		focusRootNodeId,
		focusRevision
	}: {
		viewportMode: 'graph' | 'task';
		viewportNodeIds: string[];
		viewportEdgeIds: string[];
		focusRootNodeId: string | null;
		focusRevision: number;
	}) {
		if (!cy) {
			return;
		}

		if (focusRevision < 0) {
			return;
		}

		cy.stop();

		if (viewportMode === 'graph') {
			cy.animate(
				{
					fit: {
						eles: cy.elements(),
						padding: 64
					}
				},
				{ duration: 320 }
			);
			return;
		}

		const focusElements = cy.collection();

		for (const nodeId of viewportNodeIds) {
			const node = cy.getElementById(nodeId);
			if (!node.empty()) {
				focusElements.merge(node);
			}
		}

		for (const edgeId of viewportEdgeIds) {
			const edge = cy.getElementById(edgeId);
			if (!edge.empty()) {
				focusElements.merge(edge);
			}
		}

		if (!focusElements.nonempty()) {
			const rootNode = cy.getElementById(focusRootNodeId ?? '') as NodeSingular;
			if (rootNode.empty()) {
				return;
			}

			cy.animate(
				{
					fit: {
						eles: rootNode,
						padding: 180
					}
				},
				{ duration: 320 }
			);
			return;
		}

		cy.animate(
			{
				fit: {
					eles: focusElements,
					padding: 120
				}
			},
			{ duration: 320 }
		);
	}

	onMount(() => {
		let isUnmounted = false;

		const initialize = async () => {
			const { default: cytoscape } = await import('cytoscape');

			if (isUnmounted) {
				return;
			}

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
						riskScore: node.riskScore
					}
				})),
				...graph.edges.map((edge) => ({
					classes: 'graph-edge',
					data: {
						id: edge.id,
						source: edge.source,
						target: edge.target,
						label: edge.label
					}
				}))
			];

			cy = cytoscape({
				container,
				elements,
				layout: {
					name: 'cose',
					animate: false,
					nodeRepulsion: () => 6400,
					idealEdgeLength: () => 60,
					edgeElasticity: () => 48,
					gravity: 0.25,
					numIter: 500,
					padding: 24,
					randomize: true,
					componentSpacing: 42,
					nestingFactor: 1.2
				} as never,
				userPanningEnabled: true,
				userZoomingEnabled: true,
				boxSelectionEnabled: false,
				autoungrabify: false,
				minZoom: 0.3,
				maxZoom: 2.2,
				style: [
					{
						selector: 'node',
						style: {
							label: '',
							width: 'mapData(totalTokens, 64, 1200, 12, 24)',
							height: 'mapData(totalTokens, 64, 1200, 12, 24)',
							shape: 'ellipse',
							'background-color': 'rgba(140, 160, 220, 0.25)',
							'border-width': 1.5,
							'border-color': 'rgba(140, 165, 220, 0.6)',
							'overlay-opacity': 0,
							opacity: 1,
							'transition-property': 'opacity, border-width, border-color, background-color',
							'transition-duration': '150ms'
						}
					},
					{
						selector: 'node.graph-node--muted',
						style: {
							opacity: 0.18
						}
					},
					{
						selector: 'node.graph-node--root',
						style: {
							'background-color': 'rgba(72, 194, 136, 0.34)',
							'border-color': 'rgba(72, 194, 136, 0.9)',
							'border-width': 2.3
						}
					},
					{
						selector: 'node:selected',
						style: {
							'border-width': 2.7,
							'border-color': 'rgba(255, 255, 255, 0.92)',
							'overlay-opacity': 0
						}
					},
					{
						selector: 'edge',
						style: {
							width: 1,
							'curve-style': 'bezier',
							'line-color': 'rgba(130, 100, 210, 0.28)',
							'target-arrow-shape': 'triangle',
							'target-arrow-color': 'rgba(130, 100, 210, 0.32)',
							'arrow-scale': 0.45,
							opacity: 0.82,
							'transition-property': 'opacity, width, line-color, target-arrow-color',
							'transition-duration': '150ms'
						}
					},
					{
						selector: 'edge.graph-edge--muted',
						style: {
							opacity: 0.1
						}
					},
					{
						selector: 'edge:selected',
						style: {
							width: 1.8,
							'line-color': 'rgba(200, 140, 255, 0.8)',
							'target-arrow-color': 'rgba(200, 140, 255, 0.8)',
							opacity: 1
						}
					}
				] as never
			});

			const emitNodeSelection = (nodeId: string) => {
				onNodeSelect?.(nodeId);
			};

			const emitEdgeSelection = (edgeId: string) => {
				onEdgeSelect?.(edgeId);
			};

			cy.on('tap', 'node', (event) => {
				emitNodeSelection(event.target.id());
			});

			cy.on('tap', 'edge', (event) => {
				emitEdgeSelection(event.target.id());
			});

			cy.on('select', 'node', (event) => {
				if (isSyncingSelection) {
					return;
				}

				emitNodeSelection(event.target.id());
			});

			cy.on('select', 'edge', (event) => {
				if (isSyncingSelection) {
					return;
				}

				emitEdgeSelection(event.target.id());
			});

			cy.on('tap', (event) => {
				if (event.target === cy) {
					onCanvasReset?.();
				}
			});

			syncGraphClasses({
				activeNodeIds,
				activeEdgeIds,
				selectedNodeId,
				selectedEdgeId,
				focusRootNodeId
			});
			syncViewport({
				viewportMode,
				viewportNodeIds,
				viewportEdgeIds,
				focusRootNodeId,
				focusRevision
			});
		};

		void initialize();

		return () => {
			isUnmounted = true;
			cy?.destroy();
		};
	});

	$effect(() => {
		syncGraphClasses({
			activeNodeIds,
			activeEdgeIds,
			selectedNodeId,
			selectedEdgeId,
			focusRootNodeId
		});
	});

	$effect(() => {
		syncViewport({
			viewportMode,
			viewportNodeIds,
			viewportEdgeIds,
			focusRootNodeId,
			focusRevision
		});
	});
</script>

<div class="session-graph-explorer">
	<div
		bind:this={container}
		class="session-graph-explorer__canvas"
		aria-label={`${graph.title} action graph`}
	></div>
</div>

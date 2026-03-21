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
			const { default: cytoscapeDagre } = await import('cytoscape-dagre');

			if (isUnmounted) {
				return;
			}

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
				layout: { name: 'preset' },
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
							'background-color': 'rgba(16, 16, 16, 0.12)',
							'border-width': 1.5,
							'border-color': 'rgba(16, 16, 16, 0.32)',
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
							'background-color': 'rgba(24, 111, 101, 0.22)',
							'border-color': 'rgba(24, 111, 101, 0.7)',
							'border-width': 2.3
						}
					},
					{
						selector: 'node:selected',
						style: {
							'border-width': 2.7,
							'border-color': 'rgba(16, 16, 16, 0.85)',
							'overlay-opacity': 0
						}
					},
					{
						selector: 'edge',
						style: {
							width: 1,
							'curve-style': 'bezier',
							'line-color': 'rgba(16, 16, 16, 0.18)',
							'target-arrow-shape': 'triangle',
							'target-arrow-color': 'rgba(16, 16, 16, 0.22)',
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
							'line-color': 'rgba(228, 94, 41, 0.6)',
							'target-arrow-color': 'rgba(228, 94, 41, 0.6)',
							opacity: 1
						}
					}
				] as never
			});

			const components = cy.elements().components();

			if (components.length <= 1) {
				cy.elements()
					.layout({
						name: 'dagre',
						rankDir: 'TB',
						nodeSep: 40,
						rankSep: 60,
						edgeSep: 20,
						ranker: 'network-simplex',
						animate: false,
						fit: true,
						padding: 24
					} as never)
					.run();
			} else {
				components.sort((a, b) => {
					const aId = a.nodes().map((n) => n.id()).sort()[0] ?? '';
					const bId = b.nodes().map((n) => n.id()).sort()[0] ?? '';
					return aId.localeCompare(bId);
				});

				const w = container.clientWidth || 800;
				const h = container.clientHeight || 600;
				const cols = Math.max(1, Math.round(Math.sqrt(components.length * (w / h))));
				const rows = Math.ceil(components.length / cols);
				const cellW = w / cols;
				const cellH = h / rows;

				for (let i = 0; i < components.length; i++) {
					components[i]
						.layout({
							name: 'dagre',
							rankDir: 'TB',
							nodeSep: 24,
							rankSep: 36,
							edgeSep: 12,
							ranker: 'network-simplex',
							animate: false,
							fit: false,
							padding: 0
						} as never)
						.run();

					const col = i % cols;
					const row = Math.floor(i / cols);
					const bb = components[i].boundingBox();
					const dx = cellW * (col + 0.5) - (bb.x1 + bb.x2) / 2;
					const dy = cellH * (row + 0.5) - (bb.y1 + bb.y2) / 2;

					components[i].nodes().shift({ x: dx, y: dy });
				}

				cy.fit(undefined, 24);
			}

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

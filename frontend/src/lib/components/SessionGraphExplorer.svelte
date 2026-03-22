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
			cy.animate({ fit: { eles: cy.elements(), padding: 80 } }, { duration: 280 });
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
						tone: node.tone,
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
				boxSelectionEnabled: true,
				selectionType: 'additive' as never,
				autoungrabify: false,
				minZoom: 0.08,
				maxZoom: 4,
				wheelSensitivity: 0.15,
				style: [
					// ── Base node ─────────────────────────────────────────────
					{
						selector: 'node',
						style: {
							label: 'data(label)',
							'text-valign': 'bottom',
							'text-halign': 'center',
							'text-margin-y': 5,
							'font-size': 8,
							'font-family': '"IBM Plex Mono", "Courier New", monospace',
							color: 'rgba(16, 16, 16, 0.65)',
							'text-max-width': 80,
							'text-wrap': 'ellipsis',
							width: 'mapData(totalTokens, 64, 1500, 26, 46)',
							height: 'mapData(totalTokens, 64, 1500, 26, 46)',
							shape: 'ellipse',
							'background-color': 'rgba(100, 116, 139, 0.18)',
							'border-width': 2,
							'border-color': 'rgba(100, 116, 139, 0.55)',
							'overlay-opacity': 0,
							opacity: 1,
							'transition-property': 'opacity, border-width, border-color, background-color',
							'transition-duration': '150ms'
						}
					},
					// ── Tool-type colours (core / write tones) ────────────────
					{
						selector: 'node[toolName = "read_file"]',
						style: {
							'background-color': 'rgba(59, 130, 246, 0.18)',
							'border-color': 'rgba(59, 130, 246, 0.65)'
						}
					},
					{
						selector: 'node[toolName = "write_file"]',
						style: {
							'background-color': 'rgba(245, 158, 11, 0.18)',
							'border-color': 'rgba(245, 158, 11, 0.65)'
						}
					},
					{
						selector: 'node[toolName = "bash"]',
						style: {
							'background-color': 'rgba(139, 92, 246, 0.18)',
							'border-color': 'rgba(139, 92, 246, 0.65)'
						}
					},
					{
						selector: 'node[toolName = "grep"]',
						style: {
							'background-color': 'rgba(20, 184, 166, 0.18)',
							'border-color': 'rgba(20, 184, 166, 0.65)'
						}
					},
					{
						selector: 'node[toolName = "list_dir"]',
						style: {
							'background-color': 'rgba(34, 197, 94, 0.18)',
							'border-color': 'rgba(34, 197, 94, 0.6)'
						}
					},
					{
						selector: 'node[toolName = "api_call"]',
						style: {
							'background-color': 'rgba(99, 102, 241, 0.18)',
							'border-color': 'rgba(99, 102, 241, 0.62)'
						}
					},
					// ── Tone overrides (take priority over tool colours) ──────
					{
						selector: 'node[tone = "entry"]',
						style: {
							shape: 'diamond',
							'background-color': 'rgba(24, 111, 101, 0.22)',
							'border-color': 'rgba(24, 111, 101, 0.85)',
							'border-width': 2.5,
							width: 38,
							height: 38
						}
					},
					{
						selector: 'node[tone = "exit"]',
						style: {
							shape: 'round-rectangle',
							'background-color': 'rgba(228, 94, 41, 0.18)',
							'border-color': 'rgba(228, 94, 41, 0.8)',
							'border-width': 2.5,
							width: 38,
							height: 32
						}
					},
					{
						selector: 'node[tone = "risk"]',
						style: {
							shape: 'triangle',
							'background-color': 'rgba(200, 77, 53, 0.2)',
							'border-color': 'rgba(200, 77, 53, 0.85)',
							'border-width': 2.2
						}
					},
					// ── Selection / focus states ───────────────────────────────
					{
						selector: 'node.graph-node--muted',
						style: { opacity: 0.15 }
					},
					{
						selector: 'node.graph-node--root',
						style: {
							'border-width': 3,
							'border-color': 'rgba(24, 111, 101, 0.9)'
						}
					},
					{
						selector: 'node:selected',
						style: {
							'border-width': 3.2,
							'border-color': 'rgba(16, 16, 16, 0.9)',
							'overlay-opacity': 0
						}
					},
					// ── Edges ─────────────────────────────────────────────────
					{
						selector: 'edge',
						style: {
							width: 1.4,
							'curve-style': 'bezier',
							'line-color': 'rgba(16, 16, 16, 0.22)',
							'target-arrow-shape': 'triangle',
							'target-arrow-color': 'rgba(16, 16, 16, 0.28)',
							'arrow-scale': 0.6,
							opacity: 0.85,
							'transition-property': 'opacity, width, line-color, target-arrow-color',
							'transition-duration': '150ms'
						}
					},
					{
						selector: 'edge.graph-edge--muted',
						style: { opacity: 0.08 }
					},
					{
						selector: 'edge:selected',
						style: {
							width: 2.2,
							'line-color': 'rgba(228, 94, 41, 0.7)',
							'target-arrow-color': 'rgba(228, 94, 41, 0.7)',
							opacity: 1
						}
					}
				] as never
			});

			// Force-directed layout — each task graph is a component; cose handles
			// component spacing automatically, giving a natural floating canvas feel.
			cy.layout({
				name: 'cose',
				animate: false,
				fit: true,
				padding: 80,
				componentSpacing: 160,
				idealEdgeLength: () => 100,
				nodeRepulsion: () => 900000,
				edgeElasticity: () => 120,
				nestingFactor: 5,
				gravity: 60,
				numIter: 1200,
				initialTemp: 250,
				coolingFactor: 0.95,
				minTemp: 1,
				randomize: true,
				nodeOverlap: 8
			} as never).run();

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

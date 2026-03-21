<script lang="ts">
	import type { AgentGraphPanel } from '$lib/types/agents';

	let { panel }: { panel: AgentGraphPanel } = $props();

	const nodeSizeClass: Record<AgentGraphPanel['nodes'][number]['size'], string> = {
		sm: 'graph-node--sm',
		md: 'graph-node--md',
		lg: 'graph-node--lg'
	};

	const edgeMap = $derived(new Map(panel.nodes.map((node) => [node.id, node])));
</script>

<section class="graph-panel">
	<div class="graph-panel__header">
		<h3>{panel.title}</h3>
		<p class="graph-panel__subtitle">{panel.subtitle}</p>
	</div>

	<div class="graph-canvas" aria-label={`${panel.title} graph`}>
		<svg class="graph-canvas__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
			{#each panel.edges as edge (`${edge.from}-${edge.to}`)}
				{@const from = edgeMap.get(edge.from)}
				{@const to = edgeMap.get(edge.to)}
				{#if from && to}
					<line
						x1={from.x}
						y1={from.y}
						x2={to.x}
						y2={to.y}
						class:graph-canvas__line--dashed={edge.style === 'dashed'}
					/>
				{/if}
			{/each}
		</svg>

		{#each panel.nodes as node (node.id)}
			<div
				class={`graph-node ${nodeSizeClass[node.size]} graph-node--${node.tone}`}
				style={`left:${node.x}%; top:${node.y}%;`}
			>
				<span>{node.label}</span>
			</div>
		{/each}
	</div>

	<ul class="graph-panel__legend" aria-label={`${panel.title} legend`}>
		{#each panel.legend as item (item)}
			<li>{item}</li>
		{/each}
	</ul>
</section>

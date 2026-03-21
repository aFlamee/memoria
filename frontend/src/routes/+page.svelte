<script lang="ts">
	import AgentTile from '$lib/components/AgentTile.svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import SectionHeading from '$lib/components/SectionHeading.svelte';
	import { agentSummaries } from '$lib/data/agents';
</script>

<PageShell
	title="A square index of operators, memory and toolchains."
	description="This first pass treats every agent as a record in a hard-edged archive. Pick one tile to open its static knowledge surfaces."
>
	<section class="landing-intro">
		<div class="landing-intro__statement">
			<p>Seed set</p>
			<strong>{agentSummaries.length} active records in the UI dataset</strong>
		</div>
		<div class="landing-intro__statement">
			<p>Current posture</p>
			<strong>Visual system first, behavior later</strong>
		</div>
	</section>

	<SectionHeading
		title="Each tile is an entry point into a frozen knowledge surface"
		copy="The structure is intentionally rigid and square so later activity states, queues and graph interactions have a disciplined frame to sit inside."
	/>

	<section class="agent-grid" aria-label="Agent list">
		{#each agentSummaries as agent (agent.slug)}
			<AgentTile {agent} />
		{/each}
	</section>
</PageShell>

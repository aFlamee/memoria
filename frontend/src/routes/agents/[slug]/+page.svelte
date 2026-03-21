<script lang="ts">
	import GraphPanel from '$lib/components/GraphPanel.svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import SectionHeading from '$lib/components/SectionHeading.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { AgentDetail } from '$lib/types/agents';

	let { data }: { data: { agent: AgentDetail | null } } = $props();
</script>

{#if data.agent}
	<PageShell
		title={data.agent.name}
		description={data.agent.pulse}
	>
		<div class="agent-detail">
			<section class="agent-detail__masthead">
				<div class="agent-detail__meta">
					<h2>{data.agent.role}</h2>
					<p>{data.agent.tagline}</p>
				</div>

				<div class="agent-detail__facts">
					<div>
						<span>State</span>
						<StatusBadge status={data.agent.status} />
					</div>
					<div>
						<span>Location</span>
						<strong>{data.agent.location}</strong>
					</div>
				</div>
			</section>

			<SectionHeading
				title="Static panels for the first operator-facing pass"
				copy="No canvas engine yet. These panels intentionally freeze the structure so the visual system can settle before behavior starts moving."
			/>

			<div class="graph-grid">
				{#each data.agent.panels as panel (panel.key)}
					<GraphPanel {panel} />
				{/each}
			</div>
		</div>
	</PageShell>
{:else}
	<PageShell
		title="No agent record loaded"
		description="The requested slug does not exist in the current UI dataset."
	>
		<section class="empty-state">
			<p>Use one of the seeded mock agents from the landing page and return here through its tile.</p>
			<a class="empty-state__link" href="/">Back to agent index</a>
		</section>
	</PageShell>
{/if}

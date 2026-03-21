<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { AgentSummary } from '$lib/types/agents';

	let { agent }: { agent: AgentSummary } = $props();
</script>

<a class="agent-tile" href={`/agents/${agent.slug}`} aria-label={`Open ${agent.name} details`}>
	<div class="agent-tile__topline">
		<p class="agent-tile__name">{agent.name}</p>
		<StatusBadge status={agent.status} />
	</div>

	<div class="agent-tile__body">
		<p class="agent-tile__role">{agent.role}</p>
		<p class="agent-tile__tagline">{agent.tagline}</p>
	</div>

	<div class="agent-tile__footer">
		<span>/{agent.slug}</span>
		<span>Open record</span>
	</div>
</a>

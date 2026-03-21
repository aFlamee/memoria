<script lang="ts">
	import { resolve } from '$app/paths';
	import PageShell from '$lib/components/PageShell.svelte';
	import SessionCard from '$lib/components/SessionCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { AgentOverview } from '$lib/types/observegraph';

	let { data }: { data: { agent: AgentOverview | null } } = $props();
</script>

{#if data.agent}
	<PageShell title={data.agent.instance.name} variant="compact">
		<div class="agent-detail">
			<section class="agent-detail__masthead">
				<div class="agent-detail__meta">
					<StatusBadge status={data.agent.instance.status} />
					<p class="agent-detail__context">
						{data.agent.instance.environment} · {data.agent.instance.host} · {data.agent.instance
							.modelDefault}
					</p>
				</div>

				<div class="agent-detail__facts">
					<div>
						<span>Live</span>
						<strong>{data.agent.instance.metrics.runningTasks}</strong>
					</div>
					<div>
						<span>Today</span>
						<strong>{data.agent.instance.metrics.completedToday}</strong>
					</div>
					<div>
						<span>7d Spend</span>
						<strong>{data.agent.instance.totalCostUsd7dLabel}</strong>
					</div>
					<div>
						<span>7d Tokens</span>
						<strong>{data.agent.instance.totalTokens7dLabel}</strong>
					</div>
				</div>
			</section>

			<section class="session-feed" aria-label="Sessions">
				{#each data.agent.sessions as session (session.sessionId)}
					<SessionCard {session} agentSlug={data.agent.instance.slug} />
				{/each}
			</section>
		</div>
	</PageShell>
{:else}
	<PageShell title="Not found" description="Pick a valid instance.">
		<section class="empty-state">
			<p>This instance is not in the current dataset.</p>
			<a class="empty-state__link" href={resolve('/')}>Back to agent index</a>
		</section>
	</PageShell>
{/if}

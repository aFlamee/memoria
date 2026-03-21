<script lang="ts">
	import AuditTrailPanel from '$lib/components/AuditTrailPanel.svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import SessionList from '$lib/components/SessionList.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import TaskGraph from '$lib/components/TaskGraph.svelte';
	import TemplateStrip from '$lib/components/TemplateStrip.svelte';
	import type { InstanceDetail } from '$lib/types/observegraph';

	let { data }: { data: { agent: InstanceDetail | null } } = $props();
</script>

{#if data.agent}
	<PageShell title={data.agent.instance.name} variant="compact">
		<div class="agent-detail">
			<section class="agent-detail__masthead">
				<div class="agent-detail__meta">
					<StatusBadge status={data.agent.instance.status} />
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

			<div class="detail-grid">
				<SessionList sessions={data.agent.sessions} />
				<TemplateStrip templates={data.agent.templates} />
			</div>

			{#if data.agent.primaryGraph}
				<TaskGraph graph={data.agent.primaryGraph} />
			{/if}

			{#if data.agent.auditTrail}
				<AuditTrailPanel audit={data.agent.auditTrail} />
			{/if}
		</div>
	</PageShell>
{:else}
	<PageShell title="Not found" description="Pick a valid instance.">
		<section class="empty-state">
			<p>This instance is not in the current dataset.</p>
			<a class="empty-state__link" href="/">Back to agent index</a>
		</section>
	</PageShell>
{/if}

<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import type { InstanceSummary } from '$lib/types/observegraph';

	let { instance }: { instance: InstanceSummary } = $props();
</script>

<a
	class="instance-tile"
	href={`/agents/${instance.slug}`}
	aria-label={`Open ${instance.name} details`}
>
	<div class="instance-tile__header">
		<div>
			<p class="instance-tile__name">{instance.name}</p>
			<p class="instance-tile__host">{instance.environment} · {instance.host}</p>
		</div>
		<StatusBadge status={instance.status} />
	</div>

	<div class="instance-tile__body">
		<div class="instance-tile__metric">
			<span>Live</span>
			<strong>{instance.runningTasks}</strong>
		</div>
		<div class="instance-tile__metric">
			<span>Today</span>
			<strong>{instance.completedToday}</strong>
		</div>
		<div class="instance-tile__metric">
			<span>7d spend</span>
			<strong>{instance.totalCostUsd7dLabel}</strong>
		</div>
		<div class="instance-tile__metric">
			<span>Default</span>
			<strong>{instance.modelDefault}</strong>
		</div>
	</div>

	<div class="instance-tile__footer">
		<span>{instance.lastSeenLabel}</span>
		<span>{instance.totalTokens7dLabel}</span>
	</div>
</a>

<script lang="ts">
	import InstanceTile from '$lib/components/InstanceTile.svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import type { DashboardData } from '$lib/types/observegraph';

	let { data }: { data: { dashboard: DashboardData } } = $props();

	const summary = $derived([
		{
			label: 'Instances',
			value: String(data.dashboard.instances.length)
		},
		{
			label: 'Live',
			value: String(
				data.dashboard.instances.reduce((total, instance) => total + instance.runningTasks, 0)
			)
		},
		{
			label: 'Defaults',
			value: String(new Set(data.dashboard.instances.map((instance) => instance.modelDefault)).size)
		}
	]);
</script>

<PageShell title="memoria" description="Open an instance.">
	<section class="summary-strip" aria-label="Fleet summary">
		{#each summary as item (item.label)}
			<div class="summary-strip__card">
				<span>{item.label}</span>
				<strong>{item.value}</strong>
			</div>
		{/each}
	</section>

	<section class="agent-grid" aria-label="Instance list">
		{#each data.dashboard.instances as instance (instance.slug)}
			<InstanceTile {instance} />
		{/each}
	</section>
</PageShell>

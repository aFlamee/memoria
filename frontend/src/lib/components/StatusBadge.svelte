<script lang="ts">
	import type { InstanceStatus } from '$lib/types/observegraph';

	const labels: Record<InstanceStatus, string> = {
		online: 'ONLINE',
		idle: 'IDLE',
		offline: 'OFFLINE'
	};

	let { status }: { status: InstanceStatus } = $props();
</script>

<span class={`status-badge status-badge--${status}`}>{labels[status]}</span>

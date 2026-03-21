<script lang="ts">
	import type { AgentStatus } from '$lib/types/agents';

	const labels: Record<AgentStatus, string> = {
		active: 'ACTIVE',
		idle: 'IDLE',
		training: 'TRAINING'
	};

	let { status }: { status: AgentStatus } = $props();
</script>

<span class={`status-badge status-badge--${status}`}>{labels[status]}</span>

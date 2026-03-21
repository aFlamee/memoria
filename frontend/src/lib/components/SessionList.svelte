<script lang="ts">
	import type { SessionSummary } from '$lib/types/observegraph';

	let { sessions }: { sessions: SessionSummary[] } = $props();
</script>

<section class="data-panel">
	<div class="panel-heading">
		<h3>Recent sessions</h3>
	</div>

	<ul class="stack-list">
		{#each sessions as session (session.sessionId)}
			<li class="stack-list__item">
				<div class="stack-list__row">
					<p class="stack-list__title">{session.sessionId}</p>
					<span class="stack-list__pill">{session.status}</span>
				</div>
				<div class="stack-list__meta">
					<span>{session.taskCount} tasks</span>
					<span>{session.totalCostUsdLabel}</span>
					<span>{session.gitBranch}</span>
				</div>
			</li>
		{/each}
	</ul>
</section>

<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SessionSummary } from '$lib/types/observegraph';
	import { formatDuration } from '$lib/utils/observegraph';

	let {
		session,
		agentSlug
	}: {
		session: SessionSummary;
		agentSlug: string;
	} = $props();
</script>

<a
	class="session-card"
	href={resolve(`/agents/${agentSlug}/sessions/${session.sessionId}`)}
	data-sveltekit-preload-data="eager"
	aria-label={`Open session ${session.sessionId}`}
>
	<div class="session-card__top-row">
		<div class="session-card__heading">
			<h2>{session.sessionId}</h2>
			<p>{session.gitBranch}</p>
		</div>
		<span class={`session-card__status session-card__status--${session.status}`}
			>{session.status}</span
		>
	</div>

	<div class="session-card__stats-row session-card__stats-row--grid">
		<span>{formatDuration(session.durationMs)}</span>
		<span>{session.totalCostUsdLabel}</span>
		<span>{session.taskCount} tasks</span>
		<span>{session.actionCount} actions</span>
	</div>

	{#if session.taskTitles.length > 0}
		<div class="session-card__section">
			<div class="session-card__task-list">
				{#each session.taskTitles as title, index (`${session.sessionId}-${index}-${title}`)}
					<span>{title}</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if session.notes}
		<p class="session-card__notes">{session.notes}</p>
	{/if}
</a>

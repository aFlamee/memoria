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
	aria-label={`Open session ${session.displayName} (${session.sessionId})`}
	title={session.sessionId}
>
	<div class="session-card__top-row">
		<div class="session-card__heading">
			<span class="session-card__eyebrow">Run {session.sessionShortId}</span>
			<h2>{session.displayName}</h2>
			{#if session.displaySubtitle}
				<p>{session.displaySubtitle}</p>
			{/if}
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

	{#if session.taskPreview.length > 0}
		<div class="session-card__section">
			<div class="session-card__preview-list">
				{#each session.taskPreview as title, index (`${session.sessionId}-${index}-${title}`)}
					<p>{title}</p>
				{/each}
			</div>
		</div>
	{/if}
</a>

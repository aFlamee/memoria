<script lang="ts">
	import type { AuditTrail } from '$lib/types/observegraph';

	let { audit }: { audit: AuditTrail } = $props();
</script>

<section class="data-panel">
	<div class="panel-heading">
		<h3>Audit trail</h3>
		<p>{audit.totalCostUsdLabel} · {audit.totalTokensLabel}</p>
	</div>

	<ol class="audit-list">
		{#each audit.actions as action (action.actionId)}
			<li class={`audit-list__item audit-list__item--${action.status}`}>
				<div class="audit-list__step">
					<p>
						<span>{action.sequence}.</span>
						<strong>{action.stepName}</strong>
					</p>
					<span>{action.durationMs}ms</span>
				</div>
				<div class="audit-list__tags">
					<span>{action.toolName}</span>
					<span>{action.status}</span>
					<span>risk {action.riskScore}</span>
					{#if action.isRecovery}
						<span>recovery</span>
					{/if}
					{#if action.isFlagged}
						<span>flagged</span>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</section>

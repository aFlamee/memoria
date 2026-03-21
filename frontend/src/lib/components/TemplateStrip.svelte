<script lang="ts">
	import type { TemplateSummary } from '$lib/types/observegraph';

	let { templates }: { templates: TemplateSummary[] } = $props();
</script>

<section class="data-panel">
	<div class="panel-heading">
		<h3>Defaults</h3>
	</div>

	<div class="template-strip">
		{#each templates as template (template.templateId)}
			<article class="template-strip__card">
				<p class="template-strip__type">{template.type}</p>
				<h4>{template.title}</h4>
				<div class="template-strip__stats">
					<span>{template.runCount} runs</span>
					<span>{Math.round(template.successRate * 100)}% success</span>
					<span>{template.avgTokensLabel}</span>
				</div>
			</article>
		{/each}
	</div>
</section>

<script lang="ts">
	let {
		title,
		description,
		variant = 'default',
		children
	}: {
		title: string;
		description?: string;
		variant?: 'default' | 'compact';
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class="page-shell">
	<header class={`page-shell__hero page-shell__hero--${variant}`}>
		<h1>{title}</h1>
		{#if description}
			<p class="page-shell__description">{description}</p>
		{/if}
	</header>

	<div class="page-shell__body">
		{@render children?.()}
	</div>
</div>

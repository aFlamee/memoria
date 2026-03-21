<script lang="ts">
	let {
		title,
		description,
		children
	}: {
		title: string;
		description: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class="page-shell">
	<header class="page-shell__hero">
		<h1>{title}</h1>
		<p class="page-shell__description">{description}</p>
	</header>

	<div class="page-shell__body">
		{@render children?.()}
	</div>
</div>

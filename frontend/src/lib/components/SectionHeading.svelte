<script lang="ts">
	let {
		title,
		copy
	}: {
		title: string;
		copy: string;
	} = $props();
</script>

<div class="section-heading">
	<div>
		<h2>{title}</h2>
		<p>{copy}</p>
	</div>
</div>

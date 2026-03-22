<script lang="ts">
	import type { InstanceSparklinePoint } from '$lib/types/observegraph';

	const WIDTH = 240;
	const HEIGHT = 74;
	const PAD_X = 6;
	const PAD_Y = 10;

	let { points }: { points: InstanceSparklinePoint[] } = $props();

	const plottedPoints = $derived.by(() => {
		if (points.length === 0) {
			return [];
		}

		const peak = Math.max(...points.map((point) => point.costUsd), 0);
		const safePeak = peak > 0 ? peak : 1;

		return points.map((point, index) => {
			const x =
				points.length === 1
					? WIDTH / 2
					: PAD_X + (index / (points.length - 1)) * (WIDTH - PAD_X * 2);
			const y = HEIGHT - PAD_Y - (point.costUsd / safePeak) * (HEIGHT - PAD_Y * 2);

			return {
				...point,
				x,
				y
			};
		});
	});

	const hasSignal = $derived(points.some((point) => point.costUsd > 0));
	const activeHours = $derived(points.filter((point) => point.costUsd > 0).length);
	const peakCostUsd = $derived(Math.max(0, ...points.map((point) => point.costUsd)));

	const linePath = $derived.by(() => {
		if (plottedPoints.length === 0) {
			return '';
		}

		return plottedPoints
			.map(
				(point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
			)
			.join(' ');
	});

	const areaPath = $derived.by(() => {
		if (plottedPoints.length === 0) {
			return '';
		}

		const first = plottedPoints[0];
		const last = plottedPoints[plottedPoints.length - 1];
		return `${linePath} L ${last.x.toFixed(2)} ${(HEIGHT - PAD_Y).toFixed(2)} L ${first.x.toFixed(2)} ${(HEIGHT - PAD_Y).toFixed(2)} Z`;
	});

	function formatPeakCost(value: number) {
		return value < 0.01 ? '<$0.01 peak' : `$${value.toFixed(2)} peak`;
	}
</script>

<div class="instance-sparkline" aria-hidden="true">
	<div class="instance-sparkline__meta">
		<span>7d trace</span>
		<strong>{hasSignal ? formatPeakCost(peakCostUsd) : 'awaiting signal'}</strong>
	</div>

	<svg
		class="instance-sparkline__chart"
		viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
		preserveAspectRatio="none"
	>
		{#each [0.25, 0.5, 0.75] as guide}
			<line
				x1={PAD_X}
				y1={PAD_Y + (HEIGHT - PAD_Y * 2) * guide}
				x2={WIDTH - PAD_X}
				y2={PAD_Y + (HEIGHT - PAD_Y * 2) * guide}
				class="instance-sparkline__guide"
			/>
		{/each}

		<line
			x1={PAD_X}
			y1={HEIGHT - PAD_Y}
			x2={WIDTH - PAD_X}
			y2={HEIGHT - PAD_Y}
			class="instance-sparkline__baseline"
		/>

		{#if hasSignal && areaPath}
			<path d={areaPath} class="instance-sparkline__area" />
			<path d={linePath} class="instance-sparkline__line" />
			{#if plottedPoints.length > 0}
				<circle
					cx={plottedPoints[plottedPoints.length - 1].x}
					cy={plottedPoints[plottedPoints.length - 1].y}
					r="2.8"
					class="instance-sparkline__marker"
				/>
			{/if}
		{:else}
			<path
				d={`M ${PAD_X} ${(HEIGHT - PAD_Y).toFixed(2)} L ${(WIDTH - PAD_X).toFixed(2)} ${(HEIGHT - PAD_Y).toFixed(2)}`}
				class="instance-sparkline__empty"
			/>
		{/if}
	</svg>

	<div class="instance-sparkline__footer">
		<span>{points.length} hourly buckets</span>
		<span>{activeHours} active</span>
	</div>
</div>

<style>
	.instance-sparkline {
		display: grid;
		gap: 0.45rem;
		padding: 0.8rem 0.85rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background:
			linear-gradient(180deg, rgba(24, 111, 101, 0.06), transparent 65%), rgba(255, 255, 255, 0.34);
	}

	.instance-sparkline__meta,
	.instance-sparkline__footer {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: baseline;
		min-width: 0;
	}

	.instance-sparkline__meta span,
	.instance-sparkline__footer {
		font-size: 0.74rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.instance-sparkline__meta strong {
		font-size: 0.88rem;
		font-weight: 700;
		line-height: 1.1;
		color: var(--ink);
	}

	.instance-sparkline__chart {
		display: block;
		width: 100%;
		height: 4.6rem;
		overflow: visible;
	}

	.instance-sparkline__guide {
		stroke: rgba(16, 16, 16, 0.08);
		stroke-width: 1;
		stroke-dasharray: 2 6;
	}

	.instance-sparkline__baseline {
		stroke: rgba(16, 16, 16, 0.18);
		stroke-width: 1.2;
	}

	.instance-sparkline__area {
		fill: rgba(24, 111, 101, 0.14);
	}

	.instance-sparkline__line {
		fill: none;
		stroke: var(--signal);
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.instance-sparkline__marker {
		fill: var(--surface-strong);
		stroke: var(--signal);
		stroke-width: 1.6;
	}

	.instance-sparkline__empty {
		fill: none;
		stroke: rgba(16, 16, 16, 0.28);
		stroke-width: 1.6;
		stroke-dasharray: 5 6;
		stroke-linecap: round;
	}

	@media (max-width: 560px) {
		.instance-sparkline__meta,
		.instance-sparkline__footer {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>

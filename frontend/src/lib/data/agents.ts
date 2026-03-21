import type { AgentDetail } from '$lib/types/agents';

const createPanel = (
	key: AgentDetail['panels'][number]['key'],
	title: string,
	subtitle: string,
	nodes: AgentDetail['panels'][number]['nodes'],
	edges: AgentDetail['panels'][number]['edges'],
	legend: string[]
) => ({
	key,
	title,
	subtitle,
	nodes,
	edges,
	legend
});

export const agentDetails: AgentDetail[] = [
	{
		slug: 'atlas',
		name: 'Atlas',
		role: 'System Cartographer',
		status: 'active',
		tagline: 'Maps hidden dependencies and operational blind spots.',
		location: 'Berlin Node',
		pulse: 'Routing fresh context into every downstream specialist.',
		panels: [
			createPanel(
				'capabilities',
				'Capabilities',
				'Survey, triage, route.',
				[
					{ id: 'scan', label: 'Scan', tone: 'accent', x: 18, y: 26, size: 'md' },
					{ id: 'triage', label: 'Triage', tone: 'neutral', x: 49, y: 20, size: 'lg' },
					{ id: 'route', label: 'Route', tone: 'signal', x: 78, y: 34, size: 'md' },
					{ id: 'audit', label: 'Audit', tone: 'neutral', x: 38, y: 69, size: 'sm' },
					{ id: 'handoff', label: 'Handoff', tone: 'accent', x: 73, y: 76, size: 'md' }
				],
				[
					{ from: 'scan', to: 'triage' },
					{ from: 'triage', to: 'route' },
					{ from: 'triage', to: 'audit', style: 'dashed' },
					{ from: 'route', to: 'handoff' }
				],
				['Priority lanes', 'Escalation branches', 'Load balancing']
			),
			createPanel(
				'memory',
				'Memory',
				'Recent signals held in focus.',
				[
					{ id: 'incidents', label: 'Incidents', tone: 'signal', x: 24, y: 30, size: 'md' },
					{ id: 'owners', label: 'Owners', tone: 'neutral', x: 53, y: 18, size: 'sm' },
					{ id: 'sla', label: 'SLA', tone: 'accent', x: 75, y: 29, size: 'md' },
					{ id: 'patterns', label: 'Patterns', tone: 'neutral', x: 44, y: 63, size: 'lg' },
					{ id: 'risks', label: 'Risks', tone: 'accent', x: 77, y: 74, size: 'sm' }
				],
				[
					{ from: 'incidents', to: 'patterns' },
					{ from: 'owners', to: 'patterns', style: 'dashed' },
					{ from: 'sla', to: 'patterns' },
					{ from: 'patterns', to: 'risks' }
				],
				['Hot memory clusters', 'Linked ownership', 'Risk anchors']
			),
			createPanel(
				'tools',
				'Tools',
				'Execution surface and telemetry.',
				[
					{ id: 'logs', label: 'Logs', tone: 'neutral', x: 21, y: 30, size: 'sm' },
					{ id: 'queue', label: 'Queue', tone: 'signal', x: 50, y: 22, size: 'lg' },
					{ id: 'api', label: 'API', tone: 'accent', x: 80, y: 31, size: 'sm' },
					{ id: 'alerts', label: 'Alerts', tone: 'accent', x: 37, y: 74, size: 'md' },
					{ id: 'metrics', label: 'Metrics', tone: 'neutral', x: 72, y: 76, size: 'md' }
				],
				[
					{ from: 'logs', to: 'queue' },
					{ from: 'queue', to: 'api' },
					{ from: 'queue', to: 'alerts', style: 'dashed' },
					{ from: 'queue', to: 'metrics' }
				],
				['Observed systems', 'Execution chokepoints', 'Watch channels']
			)
		]
	},
	{
		slug: 'sable',
		name: 'Sable',
		role: 'Memory Curator',
		status: 'idle',
		tagline: 'Compresses histories into reusable operational memory.',
		location: 'Archive Wing',
		pulse: 'Distilling noisy timelines into durable patterns.',
		panels: [
			createPanel(
				'capabilities',
				'Capabilities',
				'Extract, compress, index.',
				[
					{ id: 'intake', label: 'Intake', tone: 'neutral', x: 16, y: 34, size: 'sm' },
					{ id: 'cluster', label: 'Cluster', tone: 'accent', x: 45, y: 22, size: 'lg' },
					{ id: 'compress', label: 'Compress', tone: 'signal', x: 75, y: 30, size: 'md' },
					{ id: 'tag', label: 'Tag', tone: 'neutral', x: 36, y: 72, size: 'sm' },
					{ id: 'index', label: 'Index', tone: 'accent', x: 69, y: 74, size: 'md' }
				],
				[
					{ from: 'intake', to: 'cluster' },
					{ from: 'cluster', to: 'compress' },
					{ from: 'cluster', to: 'tag', style: 'dashed' },
					{ from: 'compress', to: 'index' }
				],
				['Knowledge shaping', 'Retention cuts', 'Semantic lookup']
			),
			createPanel(
				'memory',
				'Memory',
				'Long-term structures under watch.',
				[
					{ id: 'playbooks', label: 'Playbooks', tone: 'signal', x: 22, y: 27, size: 'md' },
					{ id: 'failures', label: 'Failures', tone: 'accent', x: 50, y: 18, size: 'md' },
					{ id: 'wins', label: 'Wins', tone: 'neutral', x: 80, y: 29, size: 'sm' },
					{ id: 'lessons', label: 'Lessons', tone: 'neutral', x: 42, y: 64, size: 'lg' },
					{ id: 'retention', label: 'Retention', tone: 'accent', x: 74, y: 73, size: 'sm' }
				],
				[
					{ from: 'playbooks', to: 'lessons' },
					{ from: 'failures', to: 'lessons' },
					{ from: 'wins', to: 'lessons', style: 'dashed' },
					{ from: 'lessons', to: 'retention' }
				],
				['Condensed memory', 'Loss prevention', 'Historical recall']
			),
			createPanel(
				'tools',
				'Tools',
				'Indexes, notebooks, retention rails.',
				[
					{ id: 'vector', label: 'Vector', tone: 'accent', x: 19, y: 32, size: 'sm' },
					{ id: 'vault', label: 'Vault', tone: 'signal', x: 50, y: 23, size: 'lg' },
					{ id: 'notes', label: 'Notes', tone: 'neutral', x: 79, y: 35, size: 'sm' },
					{ id: 'timeline', label: 'Timeline', tone: 'neutral', x: 33, y: 75, size: 'md' },
					{ id: 'review', label: 'Review', tone: 'accent', x: 69, y: 77, size: 'md' }
				],
				[
					{ from: 'vector', to: 'vault' },
					{ from: 'notes', to: 'vault' },
					{ from: 'vault', to: 'timeline', style: 'dashed' },
					{ from: 'vault', to: 'review' }
				],
				['Structured storage', 'Review cadence', 'Recall instrumentation']
			)
		]
	},
	{
		slug: 'rune',
		name: 'Rune',
		role: 'Toolchain Broker',
		status: 'training',
		tagline: 'Connects operators, runtimes and specialist tools.',
		location: 'Integration Floor',
		pulse: 'Stress-testing handoffs across unstable tool boundaries.',
		panels: [
			createPanel(
				'capabilities',
				'Capabilities',
				'Broker, shield, reconcile.',
				[
					{ id: 'broker', label: 'Broker', tone: 'signal', x: 22, y: 31, size: 'md' },
					{ id: 'shield', label: 'Shield', tone: 'neutral', x: 49, y: 18, size: 'lg' },
					{ id: 'reconcile', label: 'Reconcile', tone: 'accent', x: 78, y: 33, size: 'md' },
					{ id: 'patch', label: 'Patch', tone: 'accent', x: 34, y: 74, size: 'sm' },
					{ id: 'trace', label: 'Trace', tone: 'neutral', x: 69, y: 74, size: 'sm' }
				],
				[
					{ from: 'broker', to: 'shield' },
					{ from: 'shield', to: 'reconcile' },
					{ from: 'shield', to: 'patch', style: 'dashed' },
					{ from: 'reconcile', to: 'trace' }
				],
				['Boundary control', 'Fallback paths', 'Protocol stitching']
			),
			createPanel(
				'memory',
				'Memory',
				'Recent compatibility signals.',
				[
					{ id: 'versions', label: 'Versions', tone: 'neutral', x: 18, y: 29, size: 'sm' },
					{ id: 'breaks', label: 'Breaks', tone: 'signal', x: 48, y: 20, size: 'md' },
					{ id: 'fixes', label: 'Fixes', tone: 'accent', x: 79, y: 29, size: 'sm' },
					{ id: 'bridges', label: 'Bridges', tone: 'neutral', x: 40, y: 67, size: 'lg' },
					{ id: 'owners', label: 'Owners', tone: 'accent', x: 74, y: 75, size: 'sm' }
				],
				[
					{ from: 'versions', to: 'breaks' },
					{ from: 'breaks', to: 'fixes' },
					{ from: 'breaks', to: 'bridges' },
					{ from: 'bridges', to: 'owners', style: 'dashed' }
				],
				['Compatibility memory', 'Bridge patterns', 'Escalation owners']
			),
			createPanel(
				'tools',
				'Tools',
				'Brokers, runtimes, terminals.',
				[
					{ id: 'sdk', label: 'SDK', tone: 'neutral', x: 18, y: 32, size: 'sm' },
					{ id: 'router', label: 'Router', tone: 'accent', x: 49, y: 22, size: 'lg' },
					{ id: 'shell', label: 'Shell', tone: 'signal', x: 80, y: 31, size: 'md' },
					{ id: 'hooks', label: 'Hooks', tone: 'accent', x: 36, y: 75, size: 'sm' },
					{ id: 'checks', label: 'Checks', tone: 'neutral', x: 70, y: 76, size: 'md' }
				],
				[
					{ from: 'sdk', to: 'router' },
					{ from: 'router', to: 'shell' },
					{ from: 'router', to: 'hooks', style: 'dashed' },
					{ from: 'shell', to: 'checks' }
				],
				['Adapter surface', 'Execution rails', 'Verification nodes']
			)
		]
	}
];

export const agentSummaries = agentDetails.map(
	({ slug, name, role, status, tagline }) => ({
		slug,
		name,
		role,
		status,
		tagline
	})
);

export function getAgentDetail(slug: string) {
	return agentDetails.find((agent) => agent.slug === slug) ?? null;
}

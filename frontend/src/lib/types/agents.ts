export type AgentStatus = 'active' | 'idle' | 'training';

export type AgentSummary = {
	slug: string;
	name: string;
	role: string;
	status: AgentStatus;
	tagline: string;
};

export type AgentGraphNode = {
	id: string;
	label: string;
	tone: 'neutral' | 'accent' | 'signal';
	x: number;
	y: number;
	size: 'sm' | 'md' | 'lg';
};

export type AgentGraphEdge = {
	from: string;
	to: string;
	style?: 'solid' | 'dashed';
};

export type AgentGraphPanel = {
	key: 'capabilities' | 'memory' | 'tools';
	title: string;
	subtitle: string;
	nodes: AgentGraphNode[];
	edges: AgentGraphEdge[];
	legend: string[];
};

export type AgentDetail = AgentSummary & {
	location: string;
	pulse: string;
	panels: AgentGraphPanel[];
};

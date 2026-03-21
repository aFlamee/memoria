import { getAgentDetail } from '$lib/data/agents';

export function load({ params }) {
	return {
		agent: getAgentDetail(params.slug)
	};
}

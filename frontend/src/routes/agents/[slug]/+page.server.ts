import { getInstanceDetail } from '$lib/server/convex';

export async function load({ params }) {
	return {
		agent: await getInstanceDetail(params.slug)
	};
}


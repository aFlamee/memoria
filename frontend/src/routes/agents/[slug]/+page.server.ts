import { getInstanceOverview } from '$lib/server/convex';

export async function load({ params }) {
	return {
		agent: await getInstanceOverview(params.slug)
	};
}

import type { PageServerLoad } from './$types';
import { getInstanceOverview } from '$lib/server/convex';

export const load: PageServerLoad = async ({ params }) => {
	return {
		agent: await getInstanceOverview(params.slug)
	};
};

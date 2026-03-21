import type { PageServerLoad } from './$types';
import { getSessionDetail } from '$lib/server/convex';

export const load: PageServerLoad = async ({ params }) => {
	return {
		sessionView: await getSessionDetail(params.slug, params.sessionId)
	};
};

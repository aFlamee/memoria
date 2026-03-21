import { getSessionDetail } from '$lib/server/convex';

export async function load({ params }) {
	return {
		sessionView: await getSessionDetail(params.slug, params.sessionId)
	};
}

import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../../convex/_generated/api.js';
import type { AgentOverview, AgentSessionDetail, DashboardData } from '$lib/types/observegraph';

function getConvexClient() {
	if (!PUBLIC_CONVEX_URL) {
		throw new Error('PUBLIC_CONVEX_URL is not configured.');
	}
	return new ConvexHttpClient(PUBLIC_CONVEX_URL);
}

export async function getDashboardData(): Promise<DashboardData> {
	return getConvexClient().query(api.observegraph.dashboard, {});
}

export async function getInstanceOverview(slug: string): Promise<AgentOverview | null> {
	return (await getConvexClient().query(api.observegraph.instanceOverview, {
		slug
	})) as AgentOverview | null;
}

export async function getSessionDetail(
	slug: string,
	sessionId: string
): Promise<AgentSessionDetail | null> {
	return (await getConvexClient().query(api.observegraph.sessionDetail, {
		slug,
		sessionId
	})) as AgentSessionDetail | null;
}

import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../../convex/_generated/api.js';
import type { AgentOverview, AgentSessionDetail, DashboardData } from '$lib/types/observegraph';
import {
	getMockDashboardData,
	getMockInstanceOverview,
	getMockSessionDetail
} from '$lib/server/mockdata';

function getConvexClient() {
	if (env.OBSERVEGRAPH_USE_MOCK_DATA === 'true') {
		return null;
	}
	if (!publicEnv.PUBLIC_CONVEX_URL) {
		throw new Error(
			'PUBLIC_CONVEX_URL is required when OBSERVEGRAPH_USE_MOCK_DATA is disabled.'
		);
	}
	return new ConvexHttpClient(publicEnv.PUBLIC_CONVEX_URL);
}

export async function getDashboardData(): Promise<DashboardData> {
	const client = getConvexClient();
	if (!client) {
		return getMockDashboardData();
	}

	return (await client.query(api.observegraph.dashboard, {})) as DashboardData;
}

export async function getInstanceOverview(slug: string): Promise<AgentOverview | null> {
	const client = getConvexClient();
	if (!client) {
		return getMockInstanceOverview(slug);
	}

	return (await client.query(api.observegraph.instanceOverview, { slug })) as AgentOverview | null;
}

export async function getSessionDetail(
	slug: string,
	sessionId: string
): Promise<AgentSessionDetail | null> {
	const client = getConvexClient();
	if (!client) {
		return getMockSessionDetail(slug, sessionId);
	}

	return (await client.query(api.observegraph.sessionDetail, {
		slug,
		sessionId
	})) as AgentSessionDetail | null;
}

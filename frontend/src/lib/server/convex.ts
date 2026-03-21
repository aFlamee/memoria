import { env } from '$env/dynamic/private';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
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
	if (!PUBLIC_CONVEX_URL) {
		return null;
	}
	return new ConvexHttpClient(PUBLIC_CONVEX_URL);
}

export async function getDashboardData(): Promise<DashboardData> {
	const client = getConvexClient();
	if (!client) {
		return getMockDashboardData();
	}

	try {
		return await client.query(api.observegraph.dashboard, {});
	} catch (error) {
		console.warn('Falling back to local mock dashboard data because Convex is unavailable.', error);
		return getMockDashboardData();
	}
}

export async function getInstanceOverview(slug: string): Promise<AgentOverview | null> {
	const client = getConvexClient();
	if (!client) {
		return getMockInstanceOverview(slug);
	}

	try {
		return (await client.query(api.observegraph.instanceOverview, { slug })) as AgentOverview | null;
	} catch (error) {
		console.warn(
			`Falling back to local mock instance overview for "${slug}" because Convex is unavailable.`,
			error
		);
		return getMockInstanceOverview(slug);
	}
}

export async function getSessionDetail(
	slug: string,
	sessionId: string
): Promise<AgentSessionDetail | null> {
	const client = getConvexClient();
	if (!client) {
		return getMockSessionDetail(slug, sessionId);
	}

	try {
		return (await client.query(api.observegraph.sessionDetail, {
			slug,
			sessionId
		})) as AgentSessionDetail | null;
	} catch (error) {
		console.warn(
			`Falling back to local mock session detail for "${slug}/${sessionId}" because Convex is unavailable.`,
			error
		);
		return getMockSessionDetail(slug, sessionId);
	}
}

import { env } from '$env/dynamic/private';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../../convex/_generated/api.js';
import type { DashboardData, InstanceDetail } from '$lib/types/observegraph';
import { getMockDashboardData, getMockInstanceDetail } from '$lib/server/mockdata';

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

export async function getInstanceDetail(slug: string): Promise<InstanceDetail | null> {
	const client = getConvexClient();
	if (!client) {
		return getMockInstanceDetail(slug);
	}

	try {
		return (await client.query(api.observegraph.instanceDetail, { slug })) as InstanceDetail | null;
	} catch (error) {
		console.warn(`Falling back to local mock instance detail for "${slug}" because Convex is unavailable.`, error);
		return getMockInstanceDetail(slug);
	}
}

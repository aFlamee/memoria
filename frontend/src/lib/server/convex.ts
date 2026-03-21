import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { ConvexHttpClient } from 'convex/browser';

import { api } from '../../../convex/_generated/api.js';
import type { DashboardData, InstanceDetail } from '$lib/types/observegraph';

function getConvexClient() {
	if (!PUBLIC_CONVEX_URL) {
		throw new Error('PUBLIC_CONVEX_URL is not configured.');
	}
	return new ConvexHttpClient(PUBLIC_CONVEX_URL);
}

export async function getDashboardData(): Promise<DashboardData> {
	return getConvexClient().query(api.observegraph.dashboard, {});
}

export async function getInstanceDetail(slug: string): Promise<InstanceDetail | null> {
	return (await getConvexClient().query(api.observegraph.instanceDetail, { slug })) as InstanceDetail | null;
}

import { getDashboardData } from '$lib/server/convex';

export async function load() {
	return {
		dashboard: await getDashboardData()
	};
}


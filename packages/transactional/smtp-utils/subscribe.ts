// No-op — audience management not needed for self-hosted internal use
export async function subscribe(_opts: {
	email: string;
	name?: string | null;
}) {
	return;
}

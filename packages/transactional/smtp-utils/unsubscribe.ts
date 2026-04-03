// No-op — audience management not needed for self-hosted internal use
export async function unsubscribe(_opts: { email: string }) {
	return;
}

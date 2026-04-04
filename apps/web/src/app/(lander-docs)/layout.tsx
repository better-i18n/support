export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative flex min-h-svh flex-col overflow-clip">
			<main className="flex flex-1 flex-col">
				<div className="container-wrapper mx-auto">{children}</div>
			</main>
		</div>
	);
}

"use client";

const tokens = [
	{
		title: "Widget override",
		variable: "--co-theme-background",
		description:
			"Set this CSS variable on .cossistant when you want the support widget to use a custom value.",
		preview: "var(--co-theme-background, transparent)",
	},
	{
		title: "Your app theme",
		variable: "--background",
		description:
			"If the widget override is missing we grab your app theme, for example Shadcn's --background token.",
		preview: "var(--background, oklch(99% 0 0))",
	},
	{
		title: "Cossistant default",
		variable: "oklch(99% 0 0)",
		description:
			"When nothing else is defined we fall back to the neutral color shipped with Cossistant.",
		preview: "oklch(99% 0 0)",
	},
];

export function StyleTokenCascade() {
	return (
		<div className="my-10 grid gap-0">
			<div className="border border-border/60 bg-background-100/60 p-6 dark:bg-background-200/50">
				<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					Example
				</p>
				<h3 className="mt-1 font-heading font-medium text-xl">
					How we decide the value of `--co-background`
				</h3>
				<p className="mt-2 text-muted-foreground text-sm">
					We always try your widget override first, then your app theme, and
					only use our default when both are missing.
				</p>
			</div>
			<div className="grid gap-0 md:grid-cols-3">
				{tokens.map((step, index) => (
					<div
						className="hover:-translate-y-0.5 relative flex flex-col border border-border/60 bg-background-100/60 p-5 ring-1 ring-transparent transition hover:bg-background-100/80 dark:bg-background-200/50"
						key={step.variable}
					>
						<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							Step {index + 1}
						</span>
						<div className="my-4 flex items-center justify-between gap-3">
							<div>
								<p className="mb-2 font-medium">{step.title}</p>
								<p className="mt-1 text-muted-foreground text-sm">
									{step.description}
								</p>
							</div>
						</div>
						<code className="mt-auto inline-flex items-center gap-1 bg-background-200/80 px-2 py-1 font-mono text-[11px] text-muted-foreground dark:bg-background-300/60">
							{index < tokens.length - 1
								? `${step.variable} ->`
								: step.variable}
						</code>
					</div>
				))}
			</div>
			<div className="border border-border/60 bg-background-100/60 p-6 dark:bg-background-200/50">
				<p className="text-muted-foreground text-sm">
					Result: `--co-background` resolves to the first value in the list.
					Every other token (`--co-foreground`, `--co-border`, etc.) follows the
					same pattern.
				</p>
			</div>
		</div>
	);
}

export default StyleTokenCascade;

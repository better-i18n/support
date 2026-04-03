import fs from "node:fs/promises";
import path from "node:path";
import type * as React from "react";
import { highlightCode } from "@/lib/highlight-code";
import { cn } from "@/lib/utils";
import { Index } from "@/registry/__index__";
import { ComponentCode } from "./component-code";

export async function ComponentSource({
	name,
	className,
}: React.ComponentProps<"div"> & {
	name: string;
}) {
	const item = Index[name];

	if (!item) {
		return null;
	}

	const fullPath = path.join(process.cwd(), item.path);
	const code = await fs.readFile(fullPath, "utf-8");
	const highlightedCode = await highlightCode(code, "tsx");

	return (
		<div className={cn("relative my-auto", className)}>
			<ComponentCode code={code} highlightedCode={highlightedCode} />
		</div>
	);
}

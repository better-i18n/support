import type { ReactElement } from "react";

import { cn } from "../utils";

type BetterI18nLogoProps = {
	className?: string;
};

/**
 * Better i18n text logo for watermark usage.
 */
export function CossistantLogo({
	className,
}: BetterI18nLogoProps): ReactElement {
	return (
		<span
			className={cn("text-xs font-semibold", className)}
			title="Better i18n"
		>
			Better i18n
		</span>
	);
}

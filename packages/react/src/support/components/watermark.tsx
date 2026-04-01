import { useSupport } from "@cossistant/react";
import { useMemo } from "react";
import { Text } from "../text";
import { cn } from "../utils";

export type WatermarkProps = {
	className?: string;
};

export const Watermark: React.FC<WatermarkProps> = ({ className }) => {
	const { website } = useSupport();

	const betterI18nUrl = useMemo(() => {
		if (!website) {
			return "https://better-i18n.com";
		}

		const url = new URL("https://better-i18n.com");

		url.searchParams.set("ref", "chatbox");
		url.searchParams.set("domain", website.domain);
		url.searchParams.set("name", website.name);

		return url.toString();
	}, [website]);

	return (
		<a
			className={cn(
				"group/watermark flex items-center gap-1.5 font-medium text-co-primary/80 hover:text-co-blue",
				className
			)}
			href={betterI18nUrl}
			rel="noopener noreferrer"
			target="_blank"
		>
			<Text
				as="span"
				className="text-co-muted-foreground text-xs"
				textKey="common.brand.watermark"
			/>
			<span className="text-xs font-semibold transition-transform duration-200 group-focus-within/watermark:rotate-5 group-hover/watermark:scale-105">
				Better i18n
			</span>
		</a>
	);
};

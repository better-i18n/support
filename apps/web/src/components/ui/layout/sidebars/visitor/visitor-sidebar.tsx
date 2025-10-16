/** biome-ignore-all lint/nursery/noUnnecessaryConditions: ok here */
import type { RouterOutputs } from "@api/trpc/types";
import { resolveCountryDetails } from "@cossistant/location/country-utils";
import { formatInTimeZone } from "date-fns-tz";
import { Avatar } from "@/components/ui/avatar";
import { useVisitorPresenceById } from "@/contexts/visitor-presence";
import { getVisitorNameWithFallback } from "@/lib/visitors";
import { SidebarContainer } from "../container";
import { ResizableSidebar } from "../resizable-sidebar";
import { VisitorSidebarPlaceholder } from "./placeholder";
import { ValueDisplay } from "./value-display";
import { ValueGroup } from "./value-group";

type VisitorSidebarProps = {
	visitor: RouterOutputs["conversation"]["getVisitorById"];
	isLoading: boolean;
};

export function VisitorSidebar({ visitor, isLoading }: VisitorSidebarProps) {
	const fullName = visitor ? getVisitorNameWithFallback(visitor) : "";
	const presence = useVisitorPresenceById(visitor?.id);

	if (isLoading || !visitor) {
		return <VisitorSidebarPlaceholder />;
	}
	const countryDetails = resolveCountryDetails({
		country: visitor.country,
		countryCode: visitor.countryCode,
		locale: visitor.language,
		timezone: visitor.timezone,
		city: visitor.city,
	});
	const countryLabel = countryDetails.name ?? countryDetails.code;
	const localTime = formatLocalTime(visitor.timezone, visitor.language);
	const timezoneTooltip = visitor.timezone
		? `Timezone: ${visitor.timezone}`
		: undefined;

	return (
		<ResizableSidebar className="hidden lg:flex" position="right">
			<SidebarContainer>
				<div className="flex h-10 w-full items-center justify-between px-2">
					<div className="flex items-center gap-3">
						<Avatar
							fallbackName={fullName}
							lastOnlineAt={presence?.lastSeenAt ?? visitor.lastSeenAt}
							status={presence?.status}
							url={visitor.contact?.image}
							withBoringAvatar
						/>
						<div className="flex flex-col gap-0.5">
							<p className="font-medium text-sm">{fullName}</p>
							{visitor.contact ? (
								<p className="text-muted-foreground text-sm">
									{visitor.contact?.email}
								</p>
							) : (
								<p className="text-primary/50 text-sm decoration-dashed underline-offset-2">
									Not identified yet
								</p>
							)}
						</div>
					</div>
				</div>
				<div className="mt-4 flex flex-col gap-4">
					<ValueGroup>
						<ValueDisplay
							placeholder="Unknown"
							title="Country"
							value={
								countryLabel ? (
									<span className="ml-auto inline-flex items-center gap-2">
										{countryLabel}
										{countryDetails.flagEmoji ? (
											<span className="flex h-3.5 w-4.5 items-center justify-center overflow-clip rounded-sm text-2xl">
												{countryDetails.flagEmoji}
											</span>
										) : null}
									</span>
								) : null
							}
						/>
						<ValueDisplay
							placeholder="Unknown"
							title="Local time"
							tooltip={timezoneTooltip}
							value={
								<>
									{localTime.time}
									<span className="ml-2 text-primary/90">
										({localTime.offset})
									</span>
								</>
							}
						/>
						<ValueDisplay placeholder="Unknown" title="IP" value={visitor.ip} />
					</ValueGroup>
					<ValueGroup>
						{visitor.browser && (
							<ValueDisplay
								title="Browser"
								value={`${visitor.browser} / ${visitor.browserVersion}`}
							/>
						)}
						{visitor.os && (
							<ValueDisplay
								title="OS"
								value={`${visitor.os} / ${visitor.osVersion}`}
							/>
						)}
						{visitor.device && (
							<ValueDisplay
								title="Device"
								value={`${visitor.device} / ${visitor.deviceType}`}
							/>
						)}
						{visitor.viewport && (
							<ValueDisplay
								title="Viewport"
								tooltip={"The viewport is the visitor's browser window size."}
								value={visitor.viewport}
							/>
						)}
					</ValueGroup>
				</div>
			</SidebarContainer>
		</ResizableSidebar>
	);
}

function formatLocalTime(
	timezone: string | null | undefined,
	locale: string | null | undefined
): { time: string | null; offset: string | null } {
	if (!timezone) {
		return { time: null, offset: null };
	}

	const now = new Date();

	// Determine if locale uses 12-hour or 24-hour format
	let hour12 = false;

	if (locale) {
		try {
			const { hourCycle } = new Intl.DateTimeFormat(locale).resolvedOptions();
			hour12 = hourCycle === "h11" || hourCycle === "h12";
		} catch (_error) {
			// Ignore locale resolution failures and use 24-hour format
		}
	}

	try {
		// Format the time in the visitor's timezone
		const timeFormat = hour12 ? "h:mma" : "HH:mm";
		const formattedTime = formatInTimeZone(now, timezone, timeFormat);

		// Calculate GMT offset
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			timeZoneName: "shortOffset",
		});

		const parts = formatter.formatToParts(now);
		const offsetPart = parts.find((part) => part.type === "timeZoneName");

		const gmtOffset = offsetPart?.value ?? "GMT";

		return { time: `${formattedTime}`, offset: gmtOffset };
	} catch (_error) {
		// Fallback if timezone is invalid
		return { time: null, offset: null };
	}
}

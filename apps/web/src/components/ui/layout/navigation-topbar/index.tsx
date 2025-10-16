"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVisitorPresence } from "@/contexts/visitor-presence";
import { useWebsite } from "@/contexts/website";
import { Logo } from "../../logo";
import { TopbarItem } from "./topbar-item";

export function NavigationTopbar() {
	const pathname = usePathname();
	const website = useWebsite();
	const { onlineCount, isLoading } = useVisitorPresence();

	const baseInboxPath = `/${website?.slug}/inbox`;

	return (
		<header className="flex h-16 min-h-16 w-full items-center justify-between gap-4 pr-3 pl-6.5">
			<div className="flex flex-1 items-center gap-3">
				<Link className="mr-2" href={baseInboxPath}>
					<Logo className="size-5.5 text-primary" />
				</Link>
				<TopbarItem
					active={pathname.includes(baseInboxPath)}
					href={baseInboxPath}
					iconName="inbox-zero"
				>
					Inbox
				</TopbarItem>
				{process.env.NODE_ENV === "development" && (
					<TopbarItem
						active={pathname.startsWith(`/${website?.slug}/contacts`)}
						hideLabelOnMobile
						href={`/${website?.slug}/contacts`}
						iconName="contacts"
					>
						Contacts
					</TopbarItem>
				)}
				{/* {process.env.NODE_ENV === "development" && (
          <TopbarItem
            active={pathname === `/${website?.slug}/agents`}
            hideLabelOnMobile
            href={`/${website?.slug}/agents`}
            iconName="agent"
          >
            Agents
          </TopbarItem>
        )} */}
			</div>
			<div className="flex items-center gap-3">
				<div className="hidden items-center gap-3 rounded-full border border-border/60 px-3 py-1 font-medium text-primary/80 text-xs md:flex">
					<span className="flex items-center gap-2">
						<span
							aria-hidden
							className="size-2 rounded-full bg-cossistant-green"
						/>
						<p>
							{isLoading ? "—" : onlineCount} visitor
							{onlineCount > 1 ? "s" : ""} online
						</p>
					</span>
				</div>
				<TopbarItem external hideLabelOnMobile href={"/docs"}>
					Docs
				</TopbarItem>
			</div>
		</header>
	);
}

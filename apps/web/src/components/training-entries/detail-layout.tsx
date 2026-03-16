"use client";

import type { ReactNode } from "react";
import {
	PageContent,
	PageHeader,
	PageHeaderTitle,
} from "@/components/ui/layout";
import { SettingsPage } from "@/components/ui/layout/settings-layout";

type TrainingEntryDetailLayoutProps = {
	backHref: string;
	sectionLabel: string;
	title: string;
	actions?: ReactNode;
	children: ReactNode;
};

export function TrainingEntryDetailLayout({
	backHref,
	sectionLabel,
	title,
	actions,
	children,
}: TrainingEntryDetailLayoutProps) {
	return (
		<SettingsPage>
			<PageHeader
				className="border-b bg-background pr-3 pl-4 text-sm dark:bg-background-50"
				defaultBackPath={backHref}
			>
				<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
					<PageHeaderTitle className="truncate text-sm">
						{sectionLabel} / {title}
					</PageHeaderTitle>
					{actions ? (
						<div className="flex shrink-0 items-center gap-2">{actions}</div>
					) : null}
				</div>
			</PageHeader>
			<PageContent className="px-4 py-6 pt-20">
				<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
					{children}
				</div>
			</PageContent>
		</SettingsPage>
	);
}

export type { TrainingEntryDetailLayoutProps };

import { PageContent } from "@/components/ui/layout";
import {
	SettingsHeader,
	SettingsPage,
	SettingsRow,
} from "@/components/ui/layout/settings-layout";
import { ensureWebsiteAccess } from "@/lib/auth/website-access";
import { UserProfileForm } from "./user-profile-form";
import { WebsiteInformationForm } from "./website-information-form";
import { NotificationPreferencesForm } from "./notification-preferences-form";

type GeneralSettingsPageProps = {
	params: Promise<{
		websiteSlug: string;
	}>;
};

export default async function GeneralSettingsPage({
	params,
}: GeneralSettingsPageProps) {
	const { websiteSlug } = await params;
	const { user, website } = await ensureWebsiteAccess(websiteSlug);

	return (
		<SettingsPage>
			<SettingsHeader>General</SettingsHeader>
			<PageContent className="py-30">
				<SettingsRow
					description="Manage the information your visitors see across the widget and emails."
					title="Website information"
				>
					<WebsiteInformationForm
						initialContactEmail={website.contactEmail}
						initialDomain={website.domain}
						initialLogoUrl={website.logoUrl}
						initialName={website.name}
						organizationId={website.organizationId}
						websiteId={website.id}
						websiteSlug={website.slug}
					/>
				</SettingsRow>
                                <SettingsRow
                                        description="Control how your name and avatar appear to teammates across Cossistant."
                                        title="Your profile"
                                >
					<UserProfileForm
						initialAvatarUrl={user.image}
						initialName={user.name ?? ""}
						organizationId={website.organizationId}
						userId={user.id}
						websiteId={website.id}
					/>
                                </SettingsRow>
                                <SettingsRow
                                        description="Choose how Cossistant should reach you for marketing updates and inbox activity."
                                        title="Notifications"
                                >
                                        <NotificationPreferencesForm websiteSlug={website.slug} />
                                </SettingsRow>
                        </PageContent>
                </SettingsPage>
        );
}

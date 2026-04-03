// checkout/route.ts

import polarClient from "@api/lib/polar";
import { redirect } from "next/navigation";
import { ensureWebsiteAccess } from "@/lib/auth/website-access";

type BillingPageProps = {
	params: Promise<{
		websiteSlug: string;
	}>;
};

export default async function BillingRedirect({ params }: BillingPageProps) {
	const { websiteSlug } = await params;

	const { website } = await ensureWebsiteAccess(websiteSlug);

	// Should not happen, but just in case
	if (!website) {
		redirect("/select");
	}

	console.log("website", website);

	const customer = await polarClient.customers.getExternal({
		externalId: website.organizationId,
	});

	console.log("customer", customer);

	// Should not happen, but just in case
	if (!customer) {
		redirect("/select");
	}

	const customerPortal = await polarClient.customerSessions.create({
		customerId: customer.id,
	});

	console.log("customerPortal", customerPortal);

	redirect(customerPortal.customerPortalUrl);
}

// CustomerPortal({
// 	accessToken: `${process.env.POLAR_ACCESS_TOKEN}`,
// 	getCustomerId: async (
// 		req: NextRequest,
// 		{ params }: { params: { brandingId: string; agencyId: string } }
// 	) => {
// 		const websiteSlug =

// 		const { user, website } = await ensureWebsiteAccess(websiteSlug);

// 		const customer = await polarClient.customers.getExternal(website?.id);

// 		return customer.id;
// 	},
// 	server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
// });

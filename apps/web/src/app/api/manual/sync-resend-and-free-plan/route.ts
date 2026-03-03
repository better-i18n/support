/* TEMPORARY ONE-OFF ENDPOINT. DELETE AFTER USE. */
import { db, eq, isNull } from "@api/db";
import { user, website } from "@api/db/schema";
import {
	ensureFreeSubscriptionForWebsite,
	getCustomerByOrganizationId,
	getCustomerState,
	getSubscriptionForWebsite,
} from "@api/lib/plans/polar";
import {
	addUserToDefaultAudience,
	RESEND_AUDIENCE_ID,
	updateContactSubscriptionStatus,
} from "@cossistant/transactional";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BackfillFailure =
	| {
			kind: "user";
			userIds: string[];
			email: string | null;
			reason: string;
			error?: string;
	  }
	| {
			kind: "website";
			websiteId: string;
			websiteSlug: string;
			organizationId: string | null;
			reason: string;
			error?: string;
	  };

type MissingCustomerRecord = {
	organizationId: string;
	websites: Array<{
		id: string;
		slug: string;
		name: string;
	}>;
};

type UserSyncReport = {
	scanned: number;
	unique: number;
	added: number;
	updated: number;
	failures: number;
};

type WebsiteSyncReport = {
	scanned: number;
	alreadyLinked: number;
	freeCreated: number;
	skippedMissingCustomer: number;
	skippedLockContention: number;
	failures: number;
	missingCustomers: MissingCustomerRecord[];
};

function normalizeEmail(value: string | null | undefined): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

function normalizeName(value: string | null | undefined): string | undefined {
	if (typeof value !== "string") {
		return;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

function stringifyError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

async function syncUsersToResendAudience(
	failures: BackfillFailure[]
): Promise<UserSyncReport> {
	const registeredUsers = await db
		.select({
			id: user.id,
			email: user.email,
			name: user.name,
		})
		.from(user)
		.where(eq(user.isAnonymous, false));

	const dedupedUsers = new Map<
		string,
		{
			userIds: string[];
			name?: string;
		}
	>();

	let userFailureCount = 0;

	for (const registeredUser of registeredUsers) {
		const normalizedEmail = normalizeEmail(registeredUser.email);
		if (!normalizedEmail) {
			userFailureCount += 1;
			failures.push({
				kind: "user",
				userIds: [registeredUser.id],
				email: null,
				reason: "invalid_email",
				error: "Email is missing or empty.",
			});
			continue;
		}

		const normalizedName = normalizeName(registeredUser.name);
		const existing = dedupedUsers.get(normalizedEmail);

		if (existing) {
			existing.userIds.push(registeredUser.id);
			if (!existing.name && normalizedName) {
				existing.name = normalizedName;
			}
			continue;
		}

		dedupedUsers.set(normalizedEmail, {
			userIds: [registeredUser.id],
			name: normalizedName,
		});
	}

	let addedCount = 0;
	let updatedCount = 0;

	for (const [email, dedupedUser] of dedupedUsers) {
		let addError: string | undefined;
		let updateError: string | undefined;
		let didAdd = false;
		let didUpdate = false;

		try {
			didAdd = await addUserToDefaultAudience(email, dedupedUser.name);
		} catch (error) {
			addError = stringifyError(error);
		}

		if (didAdd) {
			addedCount += 1;
			continue;
		}

		try {
			didUpdate = await updateContactSubscriptionStatus(
				RESEND_AUDIENCE_ID,
				email,
				false
			);
		} catch (error) {
			updateError = stringifyError(error);
		}

		if (didUpdate) {
			updatedCount += 1;
			continue;
		}

		userFailureCount += 1;
		failures.push({
			kind: "user",
			userIds: dedupedUser.userIds,
			email,
			reason: "resend_upsert_failed",
			error: [addError, updateError].filter(Boolean).join(" | ") || undefined,
		});
	}

	return {
		scanned: registeredUsers.length,
		unique: dedupedUsers.size,
		added: addedCount,
		updated: updatedCount,
		failures: userFailureCount,
	};
}

async function syncWebsiteFreeLinks(
	failures: BackfillFailure[]
): Promise<WebsiteSyncReport> {
	const activeWebsites = await db
		.select({
			id: website.id,
			slug: website.slug,
			name: website.name,
			organizationId: website.organizationId,
		})
		.from(website)
		.where(isNull(website.deletedAt));

	const websitesByOrganization = new Map<string, typeof activeWebsites>();

	let websiteFailureCount = 0;

	for (const activeWebsite of activeWebsites) {
		const organizationId = activeWebsite.organizationId?.trim();
		if (!organizationId) {
			websiteFailureCount += 1;
			failures.push({
				kind: "website",
				websiteId: activeWebsite.id,
				websiteSlug: activeWebsite.slug,
				organizationId: null,
				reason: "missing_organization_id",
				error: "Website has no organizationId.",
			});
			continue;
		}

		const organizationWebsites =
			websitesByOrganization.get(organizationId) ?? [];
		organizationWebsites.push(activeWebsite);
		websitesByOrganization.set(organizationId, organizationWebsites);
	}

	let alreadyLinkedCount = 0;
	let freeCreatedCount = 0;
	let skippedMissingCustomerCount = 0;
	let skippedLockContentionCount = 0;
	const missingCustomers: MissingCustomerRecord[] = [];

	for (const [organizationId, organizationWebsites] of websitesByOrganization) {
		const customer = await getCustomerByOrganizationId(organizationId);

		if (!customer) {
			skippedMissingCustomerCount += organizationWebsites.length;
			missingCustomers.push({
				organizationId,
				websites: organizationWebsites.map((organizationWebsite) => ({
					id: organizationWebsite.id,
					slug: organizationWebsite.slug,
					name: organizationWebsite.name,
				})),
			});
			continue;
		}

		const customerState = await getCustomerState(customer.id);
		if (!customerState) {
			for (const organizationWebsite of organizationWebsites) {
				websiteFailureCount += 1;
				failures.push({
					kind: "website",
					websiteId: organizationWebsite.id,
					websiteSlug: organizationWebsite.slug,
					organizationId,
					reason: "customer_state_unavailable",
					error: `Unable to read customer state for customerId=${customer.id}.`,
				});
			}
			continue;
		}

		for (const organizationWebsite of organizationWebsites) {
			const existingSubscription = getSubscriptionForWebsite(
				customerState,
				organizationWebsite.id
			);

			if (existingSubscription) {
				alreadyLinkedCount += 1;
				continue;
			}

			try {
				const provisionResult = await ensureFreeSubscriptionForWebsite({
					organizationId,
					websiteId: organizationWebsite.id,
				});

				if (provisionResult.status === "created") {
					freeCreatedCount += 1;
					continue;
				}

				if (provisionResult.status === "already_exists") {
					alreadyLinkedCount += 1;
					continue;
				}

				if (provisionResult.status === "skipped_lock_contention") {
					skippedLockContentionCount += 1;
				}
			} catch (error) {
				websiteFailureCount += 1;
				failures.push({
					kind: "website",
					websiteId: organizationWebsite.id,
					websiteSlug: organizationWebsite.slug,
					organizationId,
					reason: "free_provision_failed",
					error: stringifyError(error),
				});
			}
		}
	}

	return {
		scanned: activeWebsites.length,
		alreadyLinked: alreadyLinkedCount,
		freeCreated: freeCreatedCount,
		skippedMissingCustomer: skippedMissingCustomerCount,
		skippedLockContention: skippedLockContentionCount,
		failures: websiteFailureCount,
		missingCustomers,
	};
}

async function runBackfill() {
	const startedAt = new Date();
	const startedAtMs = Date.now();
	const failures: BackfillFailure[] = [];

	const users = await syncUsersToResendAudience(failures);
	const websites = await syncWebsiteFreeLinks(failures);

	const finishedAt = new Date();

	return {
		ok: users.failures === 0 && websites.failures === 0,
		startedAt: startedAt.toISOString(),
		finishedAt: finishedAt.toISOString(),
		durationMs: Date.now() - startedAtMs,
		users,
		websites: {
			scanned: websites.scanned,
			alreadyLinked: websites.alreadyLinked,
			freeCreated: websites.freeCreated,
			skippedMissingCustomer: websites.skippedMissingCustomer,
			skippedLockContention: websites.skippedLockContention,
			failures: websites.failures,
		},
		missingCustomers: websites.missingCustomers,
		failures,
	};
}

async function handleRequest() {
	try {
		const result = await runBackfill();
		return NextResponse.json(result, {
			status: 200,
			headers: {
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				ok: false,
				error: stringifyError(error),
			},
			{
				status: 500,
				headers: {
					"Cache-Control": "no-store",
				},
			}
		);
	}
}

export async function GET() {
	return handleRequest();
}

export async function POST() {
	return handleRequest();
}

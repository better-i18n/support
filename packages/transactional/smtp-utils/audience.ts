// No-op audience management — not needed for self-hosted internal use.
// These functions exist for interface compatibility with code that calls them.

export type ContactData = {
	email: string;
	firstName?: string;
	lastName?: string;
	unsubscribed?: boolean;
};

export async function addContactToAudience(
	_audienceId: string,
	_contactData: ContactData,
): Promise<boolean> {
	return true;
}

export async function removeContactFromAudience(
	_audienceId: string,
	_email: string,
): Promise<boolean> {
	return true;
}

export async function removeContactFromAudienceById(
	_audienceId: string,
	_contactId: string,
): Promise<boolean> {
	return true;
}

export async function updateContactSubscriptionStatus(
	_audienceId: string,
	_email: string,
	_unsubscribed: boolean,
): Promise<boolean> {
	return true;
}

export async function addUserToDefaultAudience(
	_email: string,
	_name?: string,
): Promise<boolean> {
	return true;
}

export async function removeUserFromDefaultAudience(
	_email: string,
): Promise<boolean> {
	return true;
}

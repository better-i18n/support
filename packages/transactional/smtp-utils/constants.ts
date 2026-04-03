// Email system constants
export const DEFAULT_FROM_EMAIL =
	process.env.EMAIL_FROM || "Support <notifications@mail.better-i18n.com>";

export const VARIANT_TO_FROM_MAP = {
	notifications:
		process.env.EMAIL_FROM_NOTIFICATIONS || DEFAULT_FROM_EMAIL,
	marketing:
		process.env.EMAIL_FROM_MARKETING || DEFAULT_FROM_EMAIL,
} as const;

// Backward compat — audience management is no-op but callers still reference this
export const RESEND_AUDIENCE_ID = "noop";
export const ANTHONY_EMAIL = process.env.EMAIL_FROM_MARKETING || DEFAULT_FROM_EMAIL;
export const TRANSACTIONAL_EMAIL_DOMAIN = "mail.better-i18n.com";
export const DEFAULT_RESEND_AUDIENCE_ID = "noop";

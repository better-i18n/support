import { render } from "@react-email/render";
import { VARIANT_TO_FROM_MAP } from "./smtp-utils/constants";
import { transporter } from "./smtp-utils/client";
import type { EmailOptions, BulkEmailOptions } from "./smtp-utils/types";

/**
 * Send a single email via SMTP (Brevo or any SMTP provider)
 */
export const sendEmail = async (
	opts: EmailOptions,
	_options?: { idempotencyKey?: string },
) => {
	if (!transporter) {
		console.warn(
			"SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS). Skipping email send.",
		);
		return { data: null, error: new Error("SMTP not configured") };
	}

	try {
		const {
			to,
			from,
			variant = "notifications",
			bcc,
			cc,
			replyTo,
			subject,
			text,
			react,
			headers = {},
			attachments,
		} = opts;

		// Render React Email to HTML
		let html: string | undefined;
		if (react) {
			html = await render(react);
		}

		// Build plain text fallback if not provided
		let plainText = text;
		if (!plainText && react) {
			plainText = await render(react, { plainText: true });
		}

		// Build List-Unsubscribe for marketing emails
		let finalHeaders = headers;
		if (variant === "marketing") {
			finalHeaders = {
				...headers,
				"List-Unsubscribe": "<https://support.better-i18n.com/email/unsubscribe>",
				"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
			};
		}

		const result = await transporter.sendMail({
			from: from || VARIANT_TO_FROM_MAP[variant],
			to: Array.isArray(to) ? to.join(", ") : to,
			subject,
			text: plainText,
			html,
			bcc: bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc) : undefined,
			cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : undefined,
			replyTo: replyTo
				? Array.isArray(replyTo)
					? replyTo.join(", ")
					: replyTo
				: undefined,
			headers: Object.keys(finalHeaders).length > 0 ? finalHeaders : undefined,
			attachments: attachments?.map((a) => ({
				filename: a.filename,
				content: a.content,
			})),
		});

		return { data: { id: result.messageId }, error: null };
	} catch (error) {
		console.error("Failed to send email:", error);
		return { data: null, error };
	}
};

/**
 * Send multiple emails in batch via SMTP
 */
export const sendBatchEmail = async (
	opts: BulkEmailOptions,
	_options?: { idempotencyKey?: string },
) => {
	if (!transporter) {
		console.warn("SMTP is not configured. Skipping batch email send.");
		return { data: null, error: new Error("SMTP not configured") };
	}

	if (opts.length === 0) {
		return { data: null, error: null };
	}

	try {
		const results = await Promise.all(
			opts.map((emailOpts) => sendEmail(emailOpts)),
		);
		return {
			data: results.map((r) => r.data),
			error: null,
		};
	} catch (error) {
		console.error("Failed to send batch emails:", error);
		return { data: null, error };
	}
};

// Legacy exports for backward compatibility
export const sendEmailViaResend = sendEmail;
export const sendBatchEmailViaResend = sendBatchEmail;

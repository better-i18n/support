export type EmailOptions = {
	to: string | string[];
	from?: string;
	subject: string;
	variant?: "notifications" | "marketing";
	react?: React.ReactElement;
	text?: string;
	bcc?: string | string[];
	cc?: string | string[];
	replyTo?: string | string[];
	headers?: Record<string, string>;
	scheduledAt?: string; // ignored for SMTP, kept for interface compat
	tags?: Array<{ name: string; value: string }>; // ignored for SMTP
	attachments?: Array<{
		filename?: string;
		content?: Buffer | string;
	}>;
};

export type BulkEmailOptions = EmailOptions[];

// Backward compat aliases
export type ResendEmailOptions = EmailOptions;
export type ResendBulkEmailOptions = BulkEmailOptions;

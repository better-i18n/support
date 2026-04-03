import type { Context } from "hono";
import { Hono } from "hono";

const resendRouters = new Hono();

/**
 * Resend webhook handler — disabled.
 * Inbound email, bounce tracking, and complaint handling are Resend-specific
 * features not available with SMTP/Brevo. These routes return 200 as no-ops.
 */
resendRouters.post("/webhooks", async (c: Context) => {
	console.log("[Resend Webhook] Webhook received but Resend is disabled — returning 200");
	return c.json({ received: true, disabled: true }, 200);
});

export { resendRouters };

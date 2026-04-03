import { Hono } from "hono";

const polarRouters = new Hono();

// Polar billing disabled — no-op webhook handler
polarRouters.post("/webhooks", async (c) => c.json({ received: true }, 200));

export { polarRouters };

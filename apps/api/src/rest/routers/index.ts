import { OpenAPIHono } from "@hono/zod-openapi";
import { contactRouter } from "./contact";
import { conversationRouter } from "./conversation";
import { conversationEventsRouter } from "./conversation-events";
import { messagesRouter } from "./messages";
import { organizationRouter } from "./organization";
import { visitorRouter } from "./visitor";
import { websiteRouter } from "./website";

const routers = new OpenAPIHono()
	.route("/organizations", organizationRouter)
	.route("/websites", websiteRouter)
        .route("/messages", messagesRouter)
        .route("/conversation-events", conversationEventsRouter)
        .route("/conversations", conversationRouter)
	.route("/visitors", visitorRouter)
	.route("/contacts", contactRouter);

export { routers };

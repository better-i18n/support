import { z } from "@hono/zod-openapi";

/**
 * Contact metadata are stored as key value pairs
 * Values can be strings, numbers, booleans, or null
 */
export const contactMetadataSchema = z.record(
	z.string(),
	z.string().or(z.number()).or(z.boolean()).or(z.null())
);

export type ContactMetadata = z.infer<typeof contactMetadataSchema>;

export const contactNotificationPreferencesSchema = z.record(
        z.string(),
        z.unknown()
);

/**
 * Create contact request schema
 */
export const createContactRequestSchema = z.object({
	externalId: z
		.string()
		.openapi({
			description: "External identifier for the contact (e.g. from your CRM).",
			example: "user_12345",
		})
		.optional(),
	name: z
		.string()
		.openapi({
			description: "The contact's name.",
			example: "John Doe",
		})
		.optional(),
	email: z
		.string()
		.email()
		.openapi({
			description: "The contact's email address.",
			example: "john.doe@example.com",
		})
		.optional(),
	image: z
		.string()
		.url()
		.openapi({
			description: "The contact's avatar/image URL.",
			example: "https://example.com/avatar.png",
		})
		.optional(),
        metadata: contactMetadataSchema
                .openapi({
                        description: "Additional custom metadata for the contact.",
                        example: { plan: "premium", role: "admin" },
                })
                .optional(),
        notificationPreferences: contactNotificationPreferencesSchema
                .openapi({
                        description:
                                "Notification channel preferences for the contact (e.g. email, push tokens).",
                        example: {
                                email: { enabled: true },
                                browser: {
                                        enabled: true,
                                        subscription: {
                                                endpoint: "https://push.example", 
                                                keys: { p256dh: "...", auth: "..." },
                                        },
                                },
                        },
                })
                .optional(),
	contactOrganizationId: z
		.string()
		.ulid()
		.openapi({
			description: "The contact organization ID this contact belongs to.",
			example: "01JG000000000000000000000",
		})
		.optional(),
});

export type CreateContactRequest = z.infer<typeof createContactRequestSchema>;

/**
 * Update contact request schema
 */
export const updateContactRequestSchema = z.object({
	externalId: z
		.string()
		.openapi({
			description: "External identifier for the contact.",
			example: "user_12345",
		})
		.optional(),
	name: z
		.string()
		.openapi({
			description: "The contact's name.",
			example: "John Doe",
		})
		.optional(),
	email: z
		.string()
		.email()
		.openapi({
			description: "The contact's email address.",
			example: "john.doe@example.com",
		})
		.optional(),
	image: z
		.string()
		.url()
		.openapi({
			description: "The contact's avatar/image URL.",
			example: "https://example.com/avatar.png",
		})
		.optional(),
        metadata: contactMetadataSchema
                .openapi({
                        description: "Additional custom metadata for the contact.",
                        example: { plan: "premium", role: "admin" },
                })
                .optional(),
        notificationPreferences: contactNotificationPreferencesSchema
                .openapi({
                        description:
                                "Notification channel preferences for the contact (e.g. email opt-in/out).",
                        example: { email: { enabled: true } },
                })
                .optional()
                .nullable(),
	contactOrganizationId: z
		.string()
		.ulid()
		.openapi({
			description: "The contact organization ID this contact belongs to.",
			example: "01JG000000000000000000000",
		})
		.optional()
		.nullable(),
});

export type UpdateContactRequest = z.infer<typeof updateContactRequestSchema>;

/**
 * Update contact metadata request schema
 */
export const updateContactMetadataRequestSchema = z.object({
	metadata: contactMetadataSchema.openapi({
		description: "Metadata payload to merge into the contact's profile.",
		example: { plan: "premium", role: "admin" },
	}),
});

export type UpdateContactMetadataRequest = z.infer<
	typeof updateContactMetadataRequestSchema
>;

/**
 * Identify contact request schema
 * This is used to create or update a contact and link it to a visitor
 */
export const identifyContactRequestSchema = z.object({
	id: z.ulid().optional().openapi({
		description:
			"Optional contact ID to update when linking the visitor to an existing contact.",
		example: "01JG000000000000000000000",
	}),
	visitorId: z.ulid().openapi({
		description: "The visitor ID to link to the contact.",
		example: "01JG000000000000000000000",
	}),
	externalId: z
		.string()
		.openapi({
			description:
				"External identifier for the contact. Used to find existing contacts.",
			example: "user_12345",
		})
		.optional(),
	name: z
		.string()
		.openapi({
			description: "The contact's name.",
			example: "John Doe",
		})
		.optional(),
	email: z
		.string()
		.email()
		.openapi({
			description:
				"The contact's email address. Used to find existing contacts.",
			example: "john.doe@example.com",
		})
		.optional(),
	image: z
		.string()
		.url()
		.openapi({
			description: "The contact's avatar/image URL.",
			example: "https://example.com/avatar.png",
		})
		.optional(),
        metadata: contactMetadataSchema
                .openapi({
                        description: "Additional custom metadata for the contact.",
                        example: { plan: "premium", role: "admin" },
                })
                .optional(),
        notificationPreferences: contactNotificationPreferencesSchema
                .openapi({
                        description:
                                "Notification channel preferences for the contact when linking a visitor.",
                        example: { email: { enabled: true } },
                })
                .optional(),
	contactOrganizationId: z
		.string()
		.ulid()
		.openapi({
			description: "The contact organization ID this contact belongs to.",
			example: "01JG000000000000000000000",
		})
		.optional(),
});

export type IdentifyContactRequest = z.infer<
	typeof identifyContactRequestSchema
>;

/**
 * Contact response schema
 */
export const contactResponseSchema = z.object({
	id: z.ulid().openapi({
		description: "The contact's unique identifier (ULID).",
		example: "01JG000000000000000000000",
	}),
	externalId: z.string().nullable().openapi({
		description: "External identifier for the contact.",
		example: "user_12345",
	}),
	name: z.string().nullable().openapi({
		description: "The contact's name.",
		example: "John Doe",
	}),
	email: z.email().nullable().openapi({
		description: "The contact's email address.",
		example: "john.doe@example.com",
	}),
	image: z.url().nullable().openapi({
		description: "The contact's avatar/image URL.",
		example: "https://example.com/avatar.png",
	}),
        metadata: contactMetadataSchema.nullable().openapi({
                description: "Additional custom metadata for the contact.",
                example: { plan: "premium", role: "admin" },
        }),
        notificationPreferences: contactNotificationPreferencesSchema
                .nullable()
                .openapi({
                        description:
                                "Notification channel preferences stored for the contact (e.g. email opt-in/out, push tokens).",
                        example: {
                                email: { enabled: true },
                                browser: {
                                        enabled: true,
                                        subscription: {
                                                endpoint: "https://push.example",
                                                keys: { p256dh: "...", auth: "..." },
                                        },
                                },
                        },
                }),
	contactOrganizationId: z.ulid().nullable().openapi({
		description: "The contact organization ID this contact belongs to.",
		example: "01JG000000000000000000000",
	}),
	websiteId: z.ulid().openapi({
		description: "The website's unique identifier that the contact belongs to.",
		example: "01JG000000000000000000000",
	}),
	organizationId: z.ulid().openapi({
		description:
			"The organization's unique identifier that the contact belongs to.",
		example: "01JG000000000000000000000",
	}),
	userId: z.ulid().nullable().openapi({
		description: "The user ID if the contact is linked to a registered user.",
		example: "01JG000000000000000000000",
	}),
	createdAt: z.string().openapi({
		description: "When the contact was first created.",
		example: "2021-01-01T00:00:00.000Z",
	}),
	updatedAt: z.string().openapi({
		description: "When the contact record was last updated.",
		example: "2021-01-01T00:00:00.000Z",
	}),
});

export type Contact = z.infer<typeof contactResponseSchema>;
export type ContactResponse = Contact;

/**
 * Identify contact response schema
 */
export const identifyContactResponseSchema = z.object({
	contact: contactResponseSchema,
	visitorId: z.ulid().openapi({
		description: "The visitor ID that was linked to the contact.",
		example: "01JG000000000000000000000",
	}),
});

export type IdentifyContactResponse = z.infer<
	typeof identifyContactResponseSchema
>;

// Contact Organisation Schemas

/**
 * Create contact organization request schema
 */
export const createContactOrganizationRequestSchema = z.object({
	name: z.string().openapi({
		description: "The organization name.",
		example: "Acme Corporation",
	}),
	externalId: z
		.string()
		.openapi({
			description:
				"External identifier for the organization (e.g. from your CRM).",
			example: "org_12345",
		})
		.optional(),
	domain: z
		.string()
		.openapi({
			description: "The organization's domain.",
			example: "acme.com",
		})
		.optional(),
	description: z
		.string()
		.openapi({
			description: "Description of the organization.",
			example: "A leading provider of enterprise solutions",
		})
		.optional(),
	metadata: contactMetadataSchema
		.openapi({
			description: "Additional custom metadata for the organization.",
			example: { industry: "technology", employees: 500 },
		})
		.optional(),
});

export type CreateContactOrganizationRequest = z.infer<
	typeof createContactOrganizationRequestSchema
>;

/**
 * Update contact organization request schema
 */
export const updateContactOrganizationRequestSchema = z.object({
	name: z
		.string()
		.openapi({
			description: "The organization name.",
			example: "Acme Corporation",
		})
		.optional(),
	externalId: z
		.string()
		.openapi({
			description: "External identifier for the organization.",
			example: "org_12345",
		})
		.optional(),
	domain: z
		.string()
		.openapi({
			description: "The organization's domain.",
			example: "acme.com",
		})
		.optional(),
	description: z
		.string()
		.openapi({
			description: "Description of the organization.",
			example: "A leading provider of enterprise solutions",
		})
		.optional(),
	metadata: contactMetadataSchema
		.openapi({
			description: "Additional custom metadata for the organization.",
			example: { industry: "technology", employees: 500 },
		})
		.optional(),
});

export type UpdateContactOrganizationRequest = z.infer<
	typeof updateContactOrganizationRequestSchema
>;

/**
 * Contact organization response schema
 */
export const contactOrganizationResponseSchema = z.object({
	id: z.ulid().openapi({
		description: "The organization's unique identifier (ULID).",
		example: "01JG000000000000000000000",
	}),
	name: z.string().openapi({
		description: "The organization name.",
		example: "Acme Corporation",
	}),
	externalId: z.string().nullable().openapi({
		description: "External identifier for the organization.",
		example: "org_12345",
	}),
	domain: z.string().nullable().openapi({
		description: "The organization's domain.",
		example: "acme.com",
	}),
	description: z.string().nullable().openapi({
		description: "Description of the organization.",
		example: "A leading provider of enterprise solutions",
	}),
	metadata: contactMetadataSchema.nullable().openapi({
		description: "Additional custom metadata for the organization.",
		example: { industry: "technology", employees: 500 },
	}),
	websiteId: z.ulid().openapi({
		description:
			"The website's unique identifier that the organization belongs to.",
		example: "01JG000000000000000000000",
	}),
	organizationId: z.ulid().openapi({
		description:
			"The organization's unique identifier that the organization belongs to.",
		example: "01JG000000000000000000000",
	}),
	createdAt: z.string().openapi({
		description: "When the organization was first created.",
		example: "2021-01-01T00:00:00.000Z",
	}),
	updatedAt: z.string().openapi({
		description: "When the organization record was last updated.",
		example: "2021-01-01T00:00:00.000Z",
	}),
});

export type contactOrganization = z.infer<
	typeof contactOrganizationResponseSchema
>;
export type ContactOrganizationResponse = contactOrganization;

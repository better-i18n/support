CREATE TABLE "member_notification_rule" (
        "id" varchar(26) PRIMARY KEY NOT NULL,
        "member_id" varchar(26) NOT NULL,
        "notification_type" text DEFAULT 'default' NOT NULL,
        "is_enabled" boolean DEFAULT true NOT NULL,
        "settings" jsonb,
        "created_at" timestamp NOT NULL,
        "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_notification_rule"
ADD CONSTRAINT "member_notification_rule_member_id_member_id_fk"
FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_notification_rule_member_type_idx"
        ON "member_notification_rule" USING btree ("member_id","notification_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_notification_rule_member_idx"
        ON "member_notification_rule" USING btree ("member_id");
--> statement-breakpoint
CREATE TABLE "member_notification_channel" (
        "id" varchar(26) PRIMARY KEY NOT NULL,
        "rule_id" varchar(26) NOT NULL,
        "channel_type" text NOT NULL,
        "config" jsonb,
        "conditions" jsonb,
        "delay_seconds" integer DEFAULT 0 NOT NULL,
        "order_index" integer DEFAULT 0 NOT NULL,
        "is_enabled" boolean DEFAULT true NOT NULL,
        "created_at" timestamp NOT NULL,
        "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_notification_channel"
ADD CONSTRAINT "member_notification_channel_rule_id_member_notification_rule_id_fk"
FOREIGN KEY ("rule_id") REFERENCES "member_notification_rule"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_notification_channel_rule_idx"
        ON "member_notification_channel" USING btree ("rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_notification_channel_type_idx"
        ON "member_notification_channel" USING btree ("channel_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_notification_channel_order_idx"
        ON "member_notification_channel" USING btree ("rule_id","order_index");
--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "notification_preferences" jsonb;

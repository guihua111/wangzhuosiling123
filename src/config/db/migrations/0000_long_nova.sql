-- FinReach retail backend baseline.
-- The ShipAny authentication tables already exist in the configured database,
-- so this migration deliberately creates only the retail domain tables.

CREATE TABLE IF NOT EXISTS "retail_team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "retail_team_owner_user_id_user_id_fk"
		FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_team_owner"
	ON "retail_team" USING btree ("owner_user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "retail_team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "retail_team_member_team_id_retail_team_id_fk"
		FOREIGN KEY ("team_id") REFERENCES "public"."retail_team"("id")
		ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "retail_team_member_user_id_user_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
		ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_retail_team_member_user"
	ON "retail_team_member" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_retail_team_member_team_user"
	ON "retail_team_member" USING btree ("team_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_team_member_team"
	ON "retail_team_member" USING btree ("team_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "retail_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"contact_name" text NOT NULL,
	"enterprise_name" text DEFAULT '' NOT NULL,
	"industry" text NOT NULL,
	"cashflow" text DEFAULT '' NOT NULL,
	"loan" text DEFAULT '' NOT NULL,
	"followup" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT '' NOT NULL,
	"segment" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "retail_customer_team_id_retail_team_id_fk"
		FOREIGN KEY ("team_id") REFERENCES "public"."retail_team"("id")
		ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "retail_customer_owner_user_id_user_id_fk"
		FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "retail_customer_created_by_user_id_fk"
		FOREIGN KEY ("created_by") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "retail_customer_updated_by_user_id_fk"
		FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_customer_team_status"
	ON "retail_customer" USING btree ("team_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_customer_team_owner"
	ON "retail_customer" USING btree ("team_id", "owner_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_customer_team_created"
	ON "retail_customer" USING btree ("team_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "retail_customer_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"payload" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "retail_customer_audit_log_team_id_retail_team_id_fk"
		FOREIGN KEY ("team_id") REFERENCES "public"."retail_team"("id")
		ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "retail_customer_audit_log_customer_id_retail_customer_id_fk"
		FOREIGN KEY ("customer_id") REFERENCES "public"."retail_customer"("id")
		ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "retail_customer_audit_log_user_id_user_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_customer_audit_customer"
	ON "retail_customer_audit_log" USING btree ("customer_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_customer_audit_team"
	ON "retail_customer_audit_log" USING btree ("team_id", "created_at");

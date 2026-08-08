-- FinReach phase two: persistent customer business modules.

CREATE TABLE IF NOT EXISTS "retail_customer_case" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"interview_notes" text DEFAULT '' NOT NULL,
	"interview_structured" text DEFAULT '[]' NOT NULL,
	"document_data" text DEFAULT '{}' NOT NULL,
	"profile_data" text DEFAULT '{}' NOT NULL,
	"product_matches" text DEFAULT '[]' NOT NULL,
	"marketing_scripts" text DEFAULT '[]' NOT NULL,
	"materials_data" text DEFAULT '{}' NOT NULL,
	"summary_data" text DEFAULT '{}' NOT NULL,
	"rule_version" text DEFAULT '2026-08-08-v1' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "retail_customer_case_team_id_retail_team_id_fk"
		FOREIGN KEY ("team_id") REFERENCES "public"."retail_team"("id")
		ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "retail_customer_case_customer_id_retail_customer_id_fk"
		FOREIGN KEY ("customer_id") REFERENCES "public"."retail_customer"("id")
		ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "retail_customer_case_owner_user_id_user_id_fk"
		FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "retail_customer_case_created_by_user_id_fk"
		FOREIGN KEY ("created_by") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "retail_customer_case_updated_by_user_id_fk"
		FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id")
		ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_retail_customer_case_customer"
	ON "retail_customer_case" USING btree ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_customer_case_team"
	ON "retail_customer_case" USING btree ("team_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_retail_customer_case_owner"
	ON "retail_customer_case" USING btree ("owner_user_id");

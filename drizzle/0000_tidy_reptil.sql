CREATE TABLE "provider_cache" (
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"entity" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "provider_cache_provider_kind_key_pk" PRIMARY KEY("provider","kind","key")
);
--> statement-breakpoint
CREATE TABLE "shared_link" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_link_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "provider_cache_expires_at_idx" ON "provider_cache" USING btree ("expires_at");
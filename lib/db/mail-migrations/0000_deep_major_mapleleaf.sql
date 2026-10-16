CREATE SCHEMA "mail";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer,
	"sender_id" integer,
	"recipient_id" integer,
	"subject" varchar(255),
	"body" text,
	"provider_id" text,
	"recipient_address" text,
	"reply_to" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."mailboxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"contact_id" integer NOT NULL,
	"email" text NOT NULL,
	"recovery_email" text NOT NULL,
	CONSTRAINT "mailboxes_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "mailboxes_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"mailbox_id" integer NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_id" text,
	"thread_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"mailbox_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."thread_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer,
	"folder_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"mailbox_id" integer NOT NULL,
	"subject" varchar(255),
	"last_activity_date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."user_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"folder_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"email" varchar(255) NOT NULL,
	"job_title" varchar(100),
	"company" varchar(100),
	"location" varchar(100),
	"twitter" varchar(100),
	"linkedin" varchar(100),
	"github" varchar(100),
	"avatar_url" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail"."auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "mail"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."emails" ADD CONSTRAINT "emails_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "mail"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."emails" ADD CONSTRAINT "emails_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "mail"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."emails" ADD CONSTRAINT "emails_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "mail"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."mailboxes" ADD CONSTRAINT "mailboxes_auth_user_id_auth_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "mail"."auth_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."mailboxes" ADD CONSTRAINT "mailboxes_contact_id_users_id_fk" FOREIGN KEY ("contact_id") REFERENCES "mail"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."outbox" ADD CONSTRAINT "outbox_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "mail"."mailboxes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."outbox" ADD CONSTRAINT "outbox_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "mail"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."receipts" ADD CONSTRAINT "receipts_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "mail"."mailboxes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "mail"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."thread_folders" ADD CONSTRAINT "thread_folders_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "mail"."threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."thread_folders" ADD CONSTRAINT "thread_folders_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "mail"."folders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."threads" ADD CONSTRAINT "threads_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "mail"."mailboxes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."user_folders" ADD CONSTRAINT "user_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "mail"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mail"."user_folders" ADD CONSTRAINT "user_folders_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "mail"."folders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "mail"."auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_idx" ON "mail"."auth_account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_id_idx" ON "mail"."emails" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sender_id_idx" ON "mail"."emails" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipient_id_idx" ON "mail"."emails" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sent_date_idx" ON "mail"."emails" USING btree ("sent_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "receipt_mailbox_idx" ON "mail"."receipts" USING btree ("provider_id","mailbox_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "mail"."auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_idx" ON "mail"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "mail"."auth_verification" USING btree ("identifier");
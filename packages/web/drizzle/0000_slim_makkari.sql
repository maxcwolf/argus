CREATE TYPE "public"."approval_decision" AS ENUM('APPROVE_ALL', 'REJECT_ALL', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."test_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'PARTIAL');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"user_id" text NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_user_uniq" UNIQUE("test_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "story_results" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"story_id" text NOT NULL,
	"kind" text,
	"component_name" text NOT NULL,
	"story_name" text NOT NULL,
	"baseline_url" text,
	"current_url" text NOT NULL,
	"diff_url" text,
	"pixel_diff" real DEFAULT 0 NOT NULL,
	"ssim_score" real DEFAULT 1 NOT NULL,
	"has_diff" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"render_time" integer,
	"memory_usage" integer,
	"approved" boolean
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" text PRIMARY KEY NOT NULL,
	"branch" text NOT NULL,
	"base_branch" text DEFAULT 'main' NOT NULL,
	"commit_hash" text NOT NULL,
	"commit_message" text,
	"status" "test_status" DEFAULT 'PENDING' NOT NULL,
	"total_stories" integer NOT NULL,
	"changed_count" integer NOT NULL,
	"passed_count" integer NOT NULL,
	"failed_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_results" ADD CONSTRAINT "story_results_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "test_diff_idx" ON "story_results" USING btree ("test_id","has_diff");--> statement-breakpoint
CREATE INDEX "branch_created_idx" ON "tests" USING btree ("branch","created_at");
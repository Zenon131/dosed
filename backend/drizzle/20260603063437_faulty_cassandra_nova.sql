CREATE TYPE "public"."frequency" AS ENUM('once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed');--> statement-breakpoint
CREATE TABLE "dose_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"medication_id" text NOT NULL,
	"scheduled_time" text,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"name" text NOT NULL,
	"dosage" text NOT NULL,
	"frequency" "frequency" NOT NULL,
	"times" text NOT NULL,
	"notes" text,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dose_logs" ADD CONSTRAINT "dose_logs_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dose_logs_device_id_idx" ON "dose_logs" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "dose_logs_composite_idx" ON "dose_logs" USING btree ("device_id","medication_id","taken_at");--> statement-breakpoint
CREATE INDEX "medications_device_id_idx" ON "medications" USING btree ("device_id");
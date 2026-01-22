DROP INDEX `audit_logs_user_id_idx`;--> statement-breakpoint
DROP INDEX `audit_logs_event_type_idx`;--> statement-breakpoint
DROP INDEX `audit_logs_timestamp_idx`;--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_event_type_idx` ON `audit_logs` (`event_type`);--> statement-breakpoint
CREATE INDEX `audit_logs_timestamp_idx` ON `audit_logs` (`created_at`);
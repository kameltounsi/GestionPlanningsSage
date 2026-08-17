ALTER TABLE ecr_request
    ADD COLUMN IF NOT EXISTS progress_mail_interval_days INTEGER;

ALTER TABLE ecr_request
    ADD COLUMN IF NOT EXISTS progress_mail_schedule_start_date DATE;

ALTER TABLE ecr_request
    DROP CONSTRAINT IF EXISTS chk_ecr_progress_mail_interval_days;

ALTER TABLE ecr_request
    ADD CONSTRAINT chk_ecr_progress_mail_interval_days
    CHECK (progress_mail_interval_days IS NULL OR progress_mail_interval_days IN (1, 3, 7, 14, 30));

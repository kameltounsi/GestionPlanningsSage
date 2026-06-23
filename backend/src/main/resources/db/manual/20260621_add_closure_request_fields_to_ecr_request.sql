-- Manual deployment fix for existing PostgreSQL databases.
-- Adds the closure request workflow fields used before an admin marks a modification closed.
-- Safe to run multiple times.

ALTER TABLE ecr_request
    ADD COLUMN IF NOT EXISTS closure_requested boolean;

UPDATE ecr_request
SET closure_requested = false
WHERE closure_requested IS NULL;

ALTER TABLE ecr_request
    ALTER COLUMN closure_requested SET DEFAULT false;

ALTER TABLE ecr_request
    ALTER COLUMN closure_requested SET NOT NULL;

ALTER TABLE ecr_request
    ADD COLUMN IF NOT EXISTS closure_requested_date date;

ALTER TABLE ecr_request
    ADD COLUMN IF NOT EXISTS closure_requested_by varchar(255);

-- Manual deployment fix for existing PostgreSQL databases.
-- Use this if Hibernate cannot add the archived column automatically.
-- Safe to run multiple times.

ALTER TABLE ecr_request
    ADD COLUMN IF NOT EXISTS archived boolean;

UPDATE ecr_request
SET archived = false
WHERE archived IS NULL;

ALTER TABLE ecr_request
    ALTER COLUMN archived SET DEFAULT false;

ALTER TABLE ecr_request
    ALTER COLUMN archived SET NOT NULL;

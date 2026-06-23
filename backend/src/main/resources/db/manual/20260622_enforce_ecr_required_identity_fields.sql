-- Enforces external client modification numbers uniqueness at database level.
-- Run the duplicate check first if this migration fails:
-- select lower(trim(modification_number)), count(*) from ecr_request group by lower(trim(modification_number)) having count(*) > 1;
create unique index if not exists ux_ecr_request_modification_number
    on ecr_request (lower(trim(modification_number)))
    where modification_number is not null and trim(modification_number) <> '';

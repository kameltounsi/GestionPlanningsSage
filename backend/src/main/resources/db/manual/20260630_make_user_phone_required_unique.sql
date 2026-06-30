UPDATE app_user
SET phone = '+2168' || lpad(id::text, 8, '0')
WHERE phone IS NULL OR trim(phone) = '';

WITH ranked_phones AS (
    SELECT id, row_number() OVER (PARTITION BY trim(phone) ORDER BY id) AS phone_rank
    FROM app_user
    WHERE phone IS NOT NULL AND trim(phone) <> ''
)
UPDATE app_user
SET phone = '+2168' || lpad(app_user.id::text, 8, '0')
FROM ranked_phones
WHERE app_user.id = ranked_phones.id
  AND ranked_phones.phone_rank > 1;

ALTER TABLE app_user
    ALTER COLUMN phone SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_user_phone ON app_user (phone);

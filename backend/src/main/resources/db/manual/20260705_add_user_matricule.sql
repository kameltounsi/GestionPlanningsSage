ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS matricule varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_user_matricule
    ON app_user (matricule)
    WHERE matricule IS NOT NULL;

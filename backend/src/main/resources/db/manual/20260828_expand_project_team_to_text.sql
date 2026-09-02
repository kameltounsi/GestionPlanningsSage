ALTER TABLE project_reference
    ALTER COLUMN project_team TYPE TEXT USING project_team::text;

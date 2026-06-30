CREATE TABLE IF NOT EXISTS ecr_request_suppressed_action (
    request_id bigint NOT NULL,
    action_key varchar(1200) NOT NULL,
    CONSTRAINT fk_ecr_request_suppressed_action_request
        FOREIGN KEY (request_id) REFERENCES ecr_request(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ecr_request_suppressed_action
    ON ecr_request_suppressed_action (request_id, action_key);

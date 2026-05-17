-- +goose Up
-- +goose StatementBegin
DROP TABLE IF EXISTS legacy_mongo_user_map;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE legacy_mongo_user_map (
    mongo_object_id_hex TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE
);
-- +goose StatementEnd

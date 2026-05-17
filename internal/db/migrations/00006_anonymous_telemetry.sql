-- +goose Up
-- +goose StatementBegin
CREATE TABLE telemetry_settings (
    id TEXT PRIMARY KEY,
    enabled BOOL NOT NULL DEFAULT false,
    retention_days INT NOT NULL DEFAULT 30,
    export_enabled BOOL NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE telemetry_rollups_hourly (
    bucket_start TIMESTAMPTZ NOT NULL,
    metric_name TEXT NOT NULL,
    feature_area TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT '',
    status_class TEXT NOT NULL DEFAULT '',
    transport TEXT NOT NULL DEFAULT '',
    count BIGINT NOT NULL DEFAULT 0,
    sum_ms BIGINT NOT NULL DEFAULT 0,
    min_ms BIGINT NOT NULL DEFAULT 0,
    max_ms BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bucket_start, metric_name, feature_area, result, status_class, transport)
);

CREATE INDEX telemetry_rollups_hourly_bucket_desc ON telemetry_rollups_hourly (bucket_start DESC);
CREATE INDEX telemetry_rollups_hourly_metric_bucket ON telemetry_rollups_hourly (metric_name, bucket_start DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS telemetry_rollups_hourly;
DROP TABLE IF EXISTS telemetry_settings;
-- +goose StatementEnd

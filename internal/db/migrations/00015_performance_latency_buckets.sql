-- +goose Up
-- +goose StatementBegin
CREATE TABLE telemetry_latency_buckets_hourly (
    bucket_start TIMESTAMPTZ NOT NULL,
    metric_name TEXT NOT NULL,
    feature_area TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT '',
    status_class TEXT NOT NULL DEFAULT '',
    transport TEXT NOT NULL DEFAULT '',
    latency_bucket TEXT NOT NULL DEFAULT '',
    count BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bucket_start, metric_name, feature_area, result, status_class, transport, latency_bucket)
);

CREATE INDEX telemetry_latency_buckets_hourly_bucket_desc
    ON telemetry_latency_buckets_hourly (bucket_start DESC);
CREATE INDEX telemetry_latency_buckets_hourly_metric_bucket
    ON telemetry_latency_buckets_hourly (metric_name, bucket_start DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS telemetry_latency_buckets_hourly;
-- +goose StatementEnd

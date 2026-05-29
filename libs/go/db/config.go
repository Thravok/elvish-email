package db

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultOpTimeout = 10 * time.Second

// Config holds optional CockroachDB (Postgres wire), Valkey, ScyllaDB, and S3 blob-store settings from environment.
type Config struct {
	CockroachDSN   string
	ValkeyAddr     string
	ValkeyPassword string
	ValkeyDB       int

	ScyllaHosts    []string
	ScyllaKeyspace string
	ScyllaUsername string
	ScyllaPassword string
	ScyllaTLS      bool
	ScyllaLocalDC  string

	BlobEndpoint       string
	BlobRegion         string
	BlobBucket         string
	BlobAccessKey      string
	BlobSecretKey      string
	BlobForcePathStyle bool
}

// LoadConfigFromEnv reads connection settings for all four stores.
//
//	COCKROACH_DSN, VALKEY_ADDR, VALKEY_PASSWORD, VALKEY_DB
//	SCYLLA_HOSTS (comma list), SCYLLA_KEYSPACE, SCYLLA_USERNAME, SCYLLA_PASSWORD, SCYLLA_TLS, SCYLLA_LOCAL_DC
//	BLOB_S3_ENDPOINT, BLOB_S3_REGION, BLOB_S3_BUCKET, BLOB_S3_ACCESS_KEY, BLOB_S3_SECRET_KEY, BLOB_S3_FORCE_PATH_STYLE
func LoadConfigFromEnv() Config {
	valkeyDB := 0
	if s := strings.TrimSpace(os.Getenv("VALKEY_DB")); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			valkeyDB = n
		}
	}
	scyllaHosts := splitCSV(os.Getenv("SCYLLA_HOSTS"))
	scyllaKS := strings.TrimSpace(os.Getenv("SCYLLA_KEYSPACE"))
	if scyllaKS == "" {
		scyllaKS = "elvish_mail"
	}
	blobRegion := strings.TrimSpace(os.Getenv("BLOB_S3_REGION"))
	if blobRegion == "" {
		blobRegion = "us-east-1"
	}
	blobBucket := strings.TrimSpace(os.Getenv("BLOB_S3_BUCKET"))
	if blobBucket == "" {
		blobBucket = "elvish-mail"
	}
	return Config{
		CockroachDSN:   strings.TrimSpace(os.Getenv("COCKROACH_DSN")),
		ValkeyAddr:     strings.TrimSpace(os.Getenv("VALKEY_ADDR")),
		ValkeyPassword: os.Getenv("VALKEY_PASSWORD"),
		ValkeyDB:       valkeyDB,

		ScyllaHosts:    scyllaHosts,
		ScyllaKeyspace: scyllaKS,
		ScyllaUsername: strings.TrimSpace(os.Getenv("SCYLLA_USERNAME")),
		ScyllaPassword: os.Getenv("SCYLLA_PASSWORD"),
		ScyllaTLS:      envTruthy("SCYLLA_TLS"),
		ScyllaLocalDC:  strings.TrimSpace(os.Getenv("SCYLLA_LOCAL_DC")),

		BlobEndpoint:       strings.TrimSpace(os.Getenv("BLOB_S3_ENDPOINT")),
		BlobRegion:         blobRegion,
		BlobBucket:         blobBucket,
		BlobAccessKey:      strings.TrimSpace(os.Getenv("BLOB_S3_ACCESS_KEY")),
		BlobSecretKey:      os.Getenv("BLOB_S3_SECRET_KEY"),
		BlobForcePathStyle: envTruthyDefault("BLOB_S3_FORCE_PATH_STYLE", true),
	}
}

func splitCSV(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func envTruthy(key string) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	return v == "1" || v == "true" || v == "yes"
}

func envTruthyDefault(key string, def bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if v == "" {
		return def
	}
	return v == "1" || v == "true" || v == "yes"
}

// Enabled reports whether any backend is configured.
func (c Config) Enabled() bool {
	return c.CockroachDSN != "" || c.ValkeyAddr != ""
}

// ScyllaEnabled reports whether Scylla connection settings are configured.
func (c Config) ScyllaEnabled() bool {
	return len(c.ScyllaHosts) > 0
}

// BlobEnabled reports whether the S3 blob-store is configured.
func (c Config) BlobEnabled() bool {
	return c.BlobEndpoint != "" && c.BlobAccessKey != "" && c.BlobSecretKey != ""
}

// Validate returns an error for contradictory static checks (not network I/O).
func (c Config) Validate() error {
	if c.ValkeyPassword != "" && c.ValkeyAddr == "" {
		return fmt.Errorf("db: VALKEY_PASSWORD set without VALKEY_ADDR")
	}
	if c.BlobAccessKey != "" && c.BlobEndpoint == "" {
		return fmt.Errorf("db: BLOB_S3_ACCESS_KEY set without BLOB_S3_ENDPOINT")
	}
	return nil
}

// OpTimeout is the default context deadline for ping and simple operations in this package.
func OpTimeout() time.Duration {
	return defaultOpTimeout
}

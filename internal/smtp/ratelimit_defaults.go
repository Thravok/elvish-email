package smtp

import "time"

// Default per-IP SMTP rate limits (Valkey fixed window).
const (
	RateLimitMXPerHour         int64 = 120
	RateLimitSubmissionPerHour int64 = 200
	RateLimitWindow                  = time.Hour
)

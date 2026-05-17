package uptime

import (
	"encoding/json"
	"time"
)

// SnapshotKey is the Valkey key for the latest published JSON snapshot.
const SnapshotKey = "elvish:uptime:snapshot:v1"

// StatsRollup counts successful vs failed probes for the current stats window (calendar month UTC in production).
type StatsRollup struct {
	OK        int64   `json:"ok"`
	Fail      int64   `json:"fail"`
	UptimePct float64 `json:"uptime_pct"`
}

// Snapshot is the latest probe round plus rollup stats for the current calendar month (UTC) when SQL/local aggregates apply.
type Snapshot struct {
	CheckedAt RFC3339Time            `json:"checked_at"`
	Targets   []ProbeResult          `json:"targets"`
	Stats     map[string]StatsRollup `json:"stats,omitempty"`
	// StatsPeriodUTC is "2006-01" when the rollup is monthly; omitted when unknown (e.g. legacy snapshot).
	StatsPeriodUTC string `json:"stats_period_utc,omitempty"`
	// Overall counts across all targets in the current stats window (SQL or local).
	OverallOK        int64   `json:"overall_ok,omitempty"`
	OverallFail      int64   `json:"overall_fail,omitempty"`
	OverallUptimePct float64 `json:"overall_uptime_pct,omitempty"`
}

// RFC3339Time marshals time.Time as RFC3339 string in JSON.
type RFC3339Time struct{ time.Time }

func (t RFC3339Time) MarshalJSON() ([]byte, error) {
	if t.Time.IsZero() {
		return []byte(`""`), nil
	}
	return json.Marshal(t.Time.Format(time.RFC3339Nano))
}

func (t *RFC3339Time) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	if s == "" {
		t.Time = time.Time{}
		return nil
	}
	v, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		v, err = time.Parse(time.RFC3339, s)
		if err != nil {
			return err
		}
	}
	t.Time = v
	return nil
}

// MarshalSnapshot encodes a snapshot for Valkey / API responses.
func MarshalSnapshot(s *Snapshot) ([]byte, error) {
	return json.MarshalIndent(s, "", "  ")
}

// UnmarshalSnapshot decodes JSON from Valkey.
func UnmarshalSnapshot(b []byte) (*Snapshot, error) {
	var s Snapshot
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

package mock

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// seedUUID returns a deterministic UUID-like string for seed + index (no real UUID dependency).
func seedUUID(seed string, i int) string {
	h := sha256.Sum256([]byte(fmt.Sprintf("%s:%d", seed, i)))
	return hex.EncodeToString(h[:16])
}

// UUID returns a 32-char hex string for use as id in mock JSON (frontend often treats ids as strings).
func UUID(seed string, i int) string {
	return seedUUID(seed, i)
}

// NumericStr returns a string representation of a decimal for JSON (matches pgtype.Numeric behavior in API).
func NumericStr(v float64) string {
	return fmt.Sprintf("%.2f", v)
}

// DateStr returns YYYY-MM-DD for day index (days ago from now).
func DateStr(daysAgo int) string {
	t := time.Now().UTC().AddDate(0, 0, -daysAgo)
	return t.Format("2006-01-02")
}

// TimestampStr returns RFC3339 for a given index (deterministic).
func TimestampStr(i int) string {
	t := time.Now().UTC().Add(-time.Duration(i) * time.Hour)
	return t.Format(time.RFC3339)
}

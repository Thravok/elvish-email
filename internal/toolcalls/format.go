package toolcalls

import (
	"fmt"
	"strconv"
)

// FormatCount renders a compact non-negative count for cards (e.g. 34.6M, 12.4K, 42).
func FormatCount(n int64) string {
	if n < 0 {
		n = 0
	}
	if n >= 1_000_000 {
		return fmt.Sprintf("%.1fM", float64(n)/1e6)
	}
	if n >= 1_000 {
		return fmt.Sprintf("%.1fK", float64(n)/1e3)
	}
	return strconv.FormatInt(n, 10)
}

package blog

import (
	"path/filepath"
	"regexp"
	"strings"
)

var dateSlugFile = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})-(.+)\.md$`)

// SlugFromPath returns a slug inferred from the markdown filename, or "" if none could be inferred.
// Convention: YYYY-MM-DD-<slug>.md → <slug>. Otherwise basename without .md (if no slug in front matter, caller may require explicit slug).
func SlugFromPath(path string) string {
	base := filepath.Base(path)
	if m := dateSlugFile.FindStringSubmatch(base); len(m) == 3 {
		return m[2]
	}
	if strings.HasSuffix(strings.ToLower(base), ".md") {
		return strings.TrimSuffix(base, filepath.Ext(base))
	}
	return ""
}

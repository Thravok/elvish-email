package blog

import (
	"bytes"
	"fmt"
	"html/template"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/adrg/frontmatter"

	"elvish/internal/markdown"
)

// PlaceholderStat is shown when bytes/reach are unknown and no metrics source provided them.
const PlaceholderStat = "—"

// PostMeta is YAML front matter for a log entry.
type PostMeta struct {
	Slug        string   `yaml:"slug"`
	Title       string   `yaml:"title"`
	Date        string   `yaml:"date"` // ISO YYYY-MM-DD for sorting
	DisplayDate string   `yaml:"display_date"`
	Time        string   `yaml:"time"`
	Type        string   `yaml:"type"`
	Tags        []string `yaml:"tags"`
	Bytes       string   `yaml:"bytes"`
	Reach       string   `yaml:"reach"`
	Draft       bool     `yaml:"draft"`
}

// PostOpenPGP describes a detached OpenPGP signature over canonical UTF-8 bytes (typically full markdown source).
type PostOpenPGP struct {
	HasSignature   bool
	VerifiedOK     bool
	KeyFingerprint string // short display (e.g. 16 hex key id)
	ErrMsg         string
}

// Post is a rendered log entry.
type Post struct {
	PostMeta
	DateParsed   time.Time
	BodyHTML     template.HTML
	RelPermalink string // /log/slug/
	// SourcePath is the absolute path to the markdown file on disk (used to emit /log/<slug>/source.md).
	SourcePath string
	// BootstrapBody is optional full markdown (with front matter) for admin JSON when SourcePath is not a readable file.
	BootstrapBody string `json:"-" yaml:"-"`
	// DetachedOpenPGPArmored / DetachedMinisigASCII are optional raw payloads (e.g. from SQL-backed posts) for admin copy UX.
	DetachedOpenPGPArmored string `json:"-" yaml:"-"`
	DetachedMinisigASCII   string `json:"-" yaml:"-"`
	Signing                PostSigning
	OpenPGP                PostOpenPGP
}

// ParsePostMarkdown parses one markdown document (with YAML front matter) into a Post.
// contentRoot is the filesystem directory that owns markdown paths (used to anchor minisig sidecars).
// Use an empty contentRoot for virtual paths (e.g. admin API previews) to skip reading *.minisig from disk.
// pathHint is used for slug inference and, with a non-empty contentRoot, for minisign sidecars.
// When skip is true (draft front matter), post is zero and err is nil.
func ParsePostMarkdown(contentRoot, pathHint string, raw []byte, md *markdown.Renderer, metrics map[string]EntryMetrics, signing *SigningLoadOpts) (post Post, skip bool, err error) {
	sigState, err := parseSigning(contentRoot, pathHint, raw, signing)
	if err != nil {
		return Post{}, false, err
	}
	var meta PostMeta
	body, err := frontmatter.Parse(bytes.NewReader(raw), &meta)
	if err != nil {
		return Post{}, false, fmt.Errorf("%s: frontmatter: %w", pathHint, err)
	}
	if meta.Slug == "" {
		meta.Slug = SlugFromPath(pathHint)
	}
	if meta.Slug == "" {
		return Post{}, false, fmt.Errorf("%s: missing slug (set slug: in front matter or use filename YYYY-MM-DD-your-slug.md)", pathHint)
	}
	if meta.Draft {
		return Post{}, true, nil
	}
	dt, err := time.Parse("2006-01-02", strings.TrimSpace(meta.Date))
	if err != nil {
		return Post{}, false, fmt.Errorf("%s: date %q: %w", pathHint, meta.Date, err)
	}
	if meta.Tags == nil {
		meta.Tags = []string{}
	}
	ApplyMetricsToMeta(meta.Slug, &meta, metrics)
	if strings.TrimSpace(meta.Type) == "" {
		meta.Type = "notes"
	}
	if strings.TrimSpace(meta.Time) == "" {
		meta.Time = "00:00"
	}
	if tt, err := time.Parse("15:04", strings.TrimSpace(meta.Time)); err == nil {
		dt = time.Date(dt.Year(), dt.Month(), dt.Day(), tt.Hour(), tt.Minute(), 0, 0, time.UTC)
	}
	if strings.TrimSpace(meta.DisplayDate) == "" {
		dd, err := formatDisplayDate(meta.Date)
		if err != nil {
			return Post{}, false, fmt.Errorf("%s: display_date: %w", pathHint, err)
		}
		meta.DisplayDate = dd
	}
	if strings.TrimSpace(meta.Bytes) == "" {
		meta.Bytes = PlaceholderStat
	}
	if strings.TrimSpace(meta.Reach) == "" {
		meta.Reach = PlaceholderStat
	}
	htmlStr, err := md.ToHTML(body)
	if err != nil {
		return Post{}, false, fmt.Errorf("%s: markdown: %w", pathHint, err)
	}
	return Post{
		PostMeta:     meta,
		DateParsed:   dt,
		BodyHTML:     template.HTML(htmlStr),
		RelPermalink: "/log/" + meta.Slug + "/",
		SourcePath:   pathHint,
		Signing:      sigState,
	}, false, nil
}

// LoadPosts reads all *.md under dir, parses front matter, renders markdown, sorts newest first.
// metrics maps post slug → optional bytes/reach/type merged when those front matter fields are empty.
// signing may be nil; when set with VerifyPubPath, detached *.md.minisig files are verified against raw bytes.
func LoadPosts(dir string, md *markdown.Renderer, metrics map[string]EntryMetrics, signing *SigningLoadOpts) ([]Post, error) {
	if signing != nil && signing.RequireSigned && strings.TrimSpace(signing.VerifyPubPath) == "" {
		return nil, fmt.Errorf("%w (set SigningLoadOpts.VerifyPubPath)", ErrRequireSignedNeedsVerifyPubPath)
	}
	var posts []Post
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".md" {
			return nil
		}
		if filepath.Base(path) == "README.md" {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		p, skip, err := ParsePostMarkdown(dir, path, raw, md, metrics, signing)
		if err != nil {
			return err
		}
		if skip {
			return nil
		}
		posts = append(posts, p)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(posts, func(i, j int) bool {
		if posts[i].DateParsed.Equal(posts[j].DateParsed) {
			return posts[i].Time > posts[j].Time
		}
		return posts[i].DateParsed.After(posts[j].DateParsed)
	})
	return posts, nil
}

// AllTags returns unique tags sorted.
func AllTags(posts []Post) []string {
	seen := map[string]struct{}{}
	for _, p := range posts {
		for _, t := range p.Tags {
			seen[strings.ToLower(t)] = struct{}{}
		}
	}
	out := make([]string, 0, len(seen))
	for t := range seen {
		out = append(out, t)
	}
	sort.Strings(out)
	return out
}

// FilterByTag returns posts containing tag (case-insensitive), or all if tag is empty or "all".
func FilterByTag(posts []Post, tag string) []Post {
	tag = strings.TrimSpace(strings.ToLower(tag))
	if tag == "" || tag == "all" {
		return posts
	}
	var out []Post
	for _, p := range posts {
		for _, t := range p.Tags {
			if strings.EqualFold(t, tag) {
				out = append(out, p)
				break
			}
		}
	}
	return out
}

// formatDisplayDate turns 2006-01-02 into YY.MM.DD (site log style).
func formatDisplayDate(iso string) (string, error) {
	t, err := time.Parse("2006-01-02", strings.TrimSpace(iso))
	if err != nil {
		return "", err
	}
	yy := t.Year() % 100
	return fmt.Sprintf("%02d.%02d.%02d", yy, t.Month(), t.Day()), nil
}

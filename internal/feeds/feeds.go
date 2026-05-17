package feeds

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	gf "github.com/gorilla/feeds"

	"elvish/internal/blog"
	"elvish/internal/config"
)

func buildFeed(base string, h *config.Home, posts []blog.Post) *gf.Feed {
	base = strings.TrimRight(base, "/")
	feed := &gf.Feed{
		Title:       "ELVISH — log",
		Link:        &gf.Link{Href: base + "/log/"},
		Description: h.Description,
		Author:      &gf.Author{Name: "ELVISH"},
		Created:     time.Now(),
		Id:          base + "/log/",
	}
	for _, p := range posts {
		summary := firstPlainSummary(string(p.BodyHTML))
		item := &gf.Item{
			Title:       p.Title,
			Link:        &gf.Link{Href: base + p.RelPermalink},
			Description: summary,
			Content:     string(p.BodyHTML),
			Id:          base + p.RelPermalink,
			Updated:     p.DateParsed,
			Created:     p.DateParsed,
		}
		feed.Add(item)
	}
	return feed
}

// RSSAtomJSONBytes returns RSS, Atom, and JSON Feed payloads for HTTP handlers.
func RSSAtomJSONBytes(base string, h *config.Home, posts []blog.Post) (rss []byte, atom []byte, jsonFeed []byte, err error) {
	feed := buildFeed(base, h, posts)
	base = strings.TrimRight(base, "/")
	rssStr, err := feed.ToRss()
	if err != nil {
		return nil, nil, nil, err
	}
	atomStr, err := feed.ToAtom()
	if err != nil {
		return nil, nil, nil, err
	}
	jf := jsonFeedV1{
		Version:     "https://jsonfeed.org/version/1.1",
		Title:       feed.Title,
		HomePageURL: base + "/",
		FeedURL:     base + "/feed.json",
		Description: feed.Description,
		Items:       make([]jsonFeedItemV1, 0, len(posts)),
	}
	for _, p := range posts {
		summary := firstPlainSummary(string(p.BodyHTML))
		jf.Items = append(jf.Items, jsonFeedItemV1{
			ID:            base + p.RelPermalink,
			URL:           base + p.RelPermalink,
			Title:         p.Title,
			ContentHTML:   string(p.BodyHTML),
			Summary:       summary,
			DatePublished: p.DateParsed.UTC().Format(time.RFC3339),
			Tags:          p.Tags,
			DateModified:  p.DateParsed.UTC().Format(time.RFC3339),
		})
	}
	b, err := json.MarshalIndent(jf, "", "  ")
	if err != nil {
		return nil, nil, nil, err
	}
	return []byte(rssStr), []byte(atomStr), append(b, '\n'), nil
}

// WriteRSSAtomJSON writes feed.xml, atom.xml, and feed.json (JSON Feed 1.1) into outDir using absolute base (e.g. https://example.com).
func WriteRSSAtomJSON(base string, h *config.Home, posts []blog.Post, outDir string) error {
	rss, atom, jf, err := RSSAtomJSONBytes(base, h, posts)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(outDir, "feed.xml"), rss, 0644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(outDir, "atom.xml"), atom, 0644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(outDir, "feed.json"), jf, 0644); err != nil {
		return err
	}
	return nil
}

// jsonFeedV1 is JSON Feed https://jsonfeed.org/version/1.1
type jsonFeedV1 struct {
	Version     string           `json:"version"`
	Title       string           `json:"title"`
	HomePageURL string           `json:"home_page_url"`
	FeedURL     string           `json:"feed_url"`
	Description string           `json:"description,omitempty"`
	NextURL     string           `json:"next_url,omitempty"`
	Icon        string           `json:"icon,omitempty"`
	Favicon     string           `json:"favicon,omitempty"`
	Author      *jsonFeedAuthor  `json:"author,omitempty"`
	Items       []jsonFeedItemV1 `json:"items"`
}

type jsonFeedAuthor struct {
	Name string `json:"name"`
}

type jsonFeedItemV1 struct {
	ID            string   `json:"id"`
	URL           string   `json:"url"`
	Title         string   `json:"title"`
	ContentHTML   string   `json:"content_html"`
	Summary       string   `json:"summary,omitempty"`
	DatePublished string   `json:"date_published"`
	DateModified  string   `json:"date_modified,omitempty"`
	Tags          []string `json:"tags,omitempty"`
}

func firstPlainSummary(html string) string {
	var b strings.Builder
	in := false
	for _, r := range html {
		if r == '<' {
			in = true
			continue
		}
		if r == '>' {
			in = false
			continue
		}
		if !in {
			b.WriteRune(r)
		}
	}
	s := strings.TrimSpace(strings.Join(strings.Fields(b.String()), " "))
	if len(s) > 280 {
		return s[:280] + "…"
	}
	return s
}

// ValidateBaseURL returns an error if base is not an absolute http(s) URL.
func ValidateBaseURL(base string) error {
	u, err := url.Parse(base)
	if err != nil {
		return err
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return fmt.Errorf("base_url must be http(s): %q", base)
	}
	if u.Host == "" {
		return fmt.Errorf("base_url needs a host: %q", base)
	}
	return nil
}

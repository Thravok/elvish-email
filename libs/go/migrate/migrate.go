// Package migrate seeds the SQL database from on-disk content/ defaults.
package migrate

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"elvish/libs/go/blog"
	"elvish/libs/go/markdown"
	"elvish/libs/go/models"
	"elvish/libs/go/store"
)

// PostsFromDisk upserts all published markdown posts from contentRoot/blog into the posts table.
func PostsFromDisk(ctx context.Context, st *store.Store, contentRoot string) (int, error) {
	if st == nil {
		return 0, fmt.Errorf("migrate: nil store")
	}
	blogDir := filepath.Join(contentRoot, "blog")
	md := markdown.NewRenderer()
	metricsPath := filepath.Join(contentRoot, "blog", "metrics.json")
	metrics, err := blog.LoadMetricsJSON(metricsPath)
	if err != nil {
		return 0, fmt.Errorf("migrate: metrics: %w", err)
	}
	posts, err := blog.LoadPosts(blogDir, md, metrics, nil)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, p := range posts {
		raw, err := os.ReadFile(p.SourcePath)
		if err != nil {
			return n, fmt.Errorf("migrate: read %s: %w", p.SourcePath, err)
		}
		bp := &models.BlogPost{
			Slug:         p.Slug,
			Title:        p.Title,
			Date:         p.Date,
			DisplayDate:  p.DisplayDate,
			Time:         p.Time,
			Type:         p.Type,
			Tags:         append([]string(nil), p.Tags...),
			Bytes:        p.Bytes,
			Reach:        p.Reach,
			Draft:        p.Draft,
			BodyMarkdown: string(raw),
		}
		if err := st.UpsertPostBySlug(ctx, bp); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"elvish/libs/go/models"
	"github.com/jackc/pgx/v5"
)

func scanBlogPost(row pgx.Row) (*models.BlogPost, error) {
	var p models.BlogPost
	err := row.Scan(
		&p.ID, &p.Slug, &p.Title, &p.Date, &p.DisplayDate, &p.Time, &p.Type, &p.Tags,
		&p.Bytes, &p.Reach, &p.Draft, &p.BodyMarkdown, &p.DetachedOpenPGPSig, &p.DetachedMinisig,
		&p.OpenPGPKeyID, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// PostCount returns the number of non-draft posts.
func (s *Store) PostCount(ctx context.Context) (int64, error) {
	if s == nil || s.pool == nil {
		return 0, errors.New("store: nil")
	}
	var n int64
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM posts WHERE draft = false`).Scan(&n)
	return n, err
}

// ListPosts returns published posts sorted newest first (date, time desc strings as stored).
func (s *Store) ListPosts(ctx context.Context) ([]models.BlogPost, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, slug, title, date, display_date, time, type, tags, bytes, reach, draft,
		body_markdown, detached_openpgp_sig, detached_minisig, openpgp_key_id, created_at, updated_at
		FROM posts WHERE draft = false ORDER BY date DESC, time DESC`
	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.BlogPost
	for rows.Next() {
		p, err := scanBlogPost(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

// UpsertPostBySlug replaces or inserts a post by slug.
func (s *Store) UpsertPostBySlug(ctx context.Context, p *models.BlogPost) error {
	if s == nil || s.pool == nil {
		return errors.New("store: nil")
	}
	if strings.TrimSpace(p.Slug) == "" {
		return errors.New("store: empty slug")
	}
	now := time.Now().UTC()
	if p.CreatedAt.IsZero() {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	tags := p.Tags
	if tags == nil {
		tags = []string{}
	}
	const q = `INSERT INTO posts (
		slug, title, date, display_date, time, type, tags, bytes, reach, draft,
		body_markdown, detached_openpgp_sig, detached_minisig, openpgp_key_id, created_at, updated_at
	) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
	ON CONFLICT (slug) DO UPDATE SET
		title = EXCLUDED.title,
		date = EXCLUDED.date,
		display_date = EXCLUDED.display_date,
		time = EXCLUDED.time,
		type = EXCLUDED.type,
		tags = EXCLUDED.tags,
		bytes = EXCLUDED.bytes,
		reach = EXCLUDED.reach,
		draft = EXCLUDED.draft,
		body_markdown = EXCLUDED.body_markdown,
		detached_openpgp_sig = EXCLUDED.detached_openpgp_sig,
		detached_minisig = EXCLUDED.detached_minisig,
		openpgp_key_id = EXCLUDED.openpgp_key_id,
		created_at = posts.created_at,
		updated_at = EXCLUDED.updated_at
	RETURNING id, created_at, updated_at`
	return s.pool.QueryRow(ctx, q,
		p.Slug, p.Title, p.Date, p.DisplayDate, p.Time, p.Type, tags, p.Bytes, p.Reach, p.Draft,
		p.BodyMarkdown, p.DetachedOpenPGPSig, p.DetachedMinisig, p.OpenPGPKeyID, p.CreatedAt, p.UpdatedAt,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

// GetPostBySlug loads one post by slug (including drafts).
func (s *Store) GetPostBySlug(ctx context.Context, slug string) (*models.BlogPost, error) {
	if s == nil || s.pool == nil {
		return nil, errors.New("store: nil")
	}
	const q = `SELECT id, slug, title, date, display_date, time, type, tags, bytes, reach, draft,
		body_markdown, detached_openpgp_sig, detached_minisig, openpgp_key_id, created_at, updated_at
		FROM posts WHERE slug = $1`
	p, err := scanBlogPost(s.pool.QueryRow(ctx, q, slug))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return p, err
}

# Static documentation site (MkDocs Material → nginx).
# Build context: repository root.
#   docker build -f docker/docs/Dockerfile -t elvish-docs .
#   docker run --rm -p 8766:8080 elvish-docs

FROM python:3.12-slim AS build

WORKDIR /src

COPY docs-site/requirements.txt docs-site/
RUN pip install --no-cache-dir -r docs-site/requirements.txt

COPY docs-site/mkdocs.yml docs-site/
COPY docs /src/docs
COPY README.md CONTRIBUTING.md /src/

RUN mkdir -p /src/docs/guides && \
	cp /src/README.md /src/docs/guides/product-readme.md && \
	cp /src/CONTRIBUTING.md /src/docs/guides/contributing.md

WORKDIR /src/docs-site
RUN mkdocs build

FROM nginx:1.27-alpine

COPY docker/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/docs-site/site /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

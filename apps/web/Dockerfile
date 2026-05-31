FROM nginx:1.27-alpine
COPY apps/web /usr/share/nginx/html
COPY docker/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/write-api-config.sh /runtime/write-api-config.sh
RUN chmod +x /runtime/write-api-config.sh
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
	CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/runtime/write-api-config.sh"]

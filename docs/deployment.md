# Deployment

## Docker

| Compose file | Images | Requirements |
|---|---|---|
| `docker-compose.standalone.yml` | Built locally | Docker; exposes localhost:8080 |
| `docker-compose.yml` | Built locally | Configured Traefik and external `traefik` network |
| `docker-compose.registry.yml` | Pulled from GHCR | Configured Traefik and external `traefik` network |

```bash
# No Traefik required:
docker compose -f docker-compose.standalone.yml up -d --build

# Frontend only:
docker compose -f docker-compose.standalone.yml up -d --build sudoku

# Traefik deployment; edit SUDOKU_HOST in .env first:
cp .env.example .env
docker compose up -d --build

# Published images; set SUDOKU_OWNER and SUDOKU_TAG in .env:
docker compose -f docker-compose.registry.yml pull
docker compose -f docker-compose.registry.yml up -d
```

The standalone port mapping binds to host interfaces by default; restrict it in
your deployment configuration if you need loopback-only access.

nginx resolves `LEADERBOARD_UPSTREAM` per request, allowing the frontend to start
without the API. Defaults are `http://leaderboard:3001` and
`NGINX_RESOLVER=127.0.0.11` (Docker DNS).

API scores live in the `leaderboard-data` volume at `/app/data`. Back it up before
migration; removing the volume deletes scores. The API runs as `node`. A volume
created by an older root image may require this one-time ownership repair:

```bash
docker compose exec -u root leaderboard chown -R node:node /app/data
```

## Optional API

```bash
npm ci --prefix leaderboard-api
node leaderboard-api/server.js
```

The API defaults to port 3001. Vite proxies `/api/` to it during development;
Docker nginx provides the production proxy. A disk build uses localhost:3001
unless configured otherwise. Ordinary HTTP hosting uses the page's origin.

Cross-origin browser access is disabled by default. For a separate frontend
origin, set `CORS_ORIGIN` to that exact origin. A `file://` frontend uses the
`null` origin; allowing it also allows other opaque origins, so enable that only
when you need local disk access to the API.
Set `TRUST_PROXY` to the actual number of trusted proxy hops (the provided stacks
use one for nginx and two for Traefik plus nginx); direct access defaults to zero.
The API defaults to five submissions per minute per client IP.

Endpoints: `GET /api/health`, `GET /api/leaderboard`,
`GET /api/leaderboard/:difficulty`, and `POST /api/leaderboard`. Rankings retain
up to 100 entries per tier; tier GET returns up to 50 and summary GET up to 10.
There is no per-level filter. Scores are client-reported and are not proof of a
verified solve. JSON-file storage is intended for a small single-instance API.

## Static hosting

```bash
npm ci
SUDOKU_SITE_URL=https://sudoku.example.com npm run build
```

Serve `dist/` over HTTP(S). Use HTTPS for production PWA support. Keep the directory
layout intact, including `licenses/`. Set `SUDOKU_SITE_URL` at build time to change
canonical and social-preview URLs from the project's default public URL.

For a remote leaderboard, also set `SUDOKU_API_BASE` when building and configure
the API's `CORS_ORIGIN` to match the frontend origin. Without an available API,
the app hides leaderboard controls.

Cloudflare Pages can use `npm run build` and output `dist`; Netlify has
`netlify.toml`. `wrangler.jsonc` configures asset deployment separately. Other
hosts can serve the same directory. Apply `public/_headers` cache rules on hosts
that support that format, or reproduce them in your server configuration:
revalidate HTML and the worker, cache hashed assets long-term. The build supports
subpaths; a subpath deployment must also route requests to its entry document.

## CI and image tags

CI installs Chromium and WebKit, runs the configured browser tests,
build containers, check frontend startup without the API, and exercise the API
as an unprivileged process with a fresh named volume. The API smoke test submits
a score, checks the on-disk JSON, recreates the container using that same volume,
and reads the score back. Browser failures fail CI; self-hosted runners need the
browser system libraries and access to a Docker daemon.

GitHub publishes both GHCR images only after check, browser, and container jobs
pass, for pushes to `main` or version tags. Both metadata steps disable automatic
`latest` tags. Only the explicit `main` branch rule emits `latest`; version tags
do not move it. Main also emits `sha-<full-commit-sha>` for pinning. Stable version
tags emit full, minor, and major versions; prereleases emit their full version.

```bash
SUDOKU_TAG=sha-<full-commit-sha> docker compose -f docker-compose.registry.yml up -d
```

Preserve published tags. Release a new version for changes instead of moving an
existing release tag. Dependabot version-update PRs are disabled by configuration;
security alerts and security-update PRs are separate repository settings.
Lighthouse runs separately and does not certify every theme or browser state.
Self-hosted Lighthouse runners need Chrome installed; a missing browser or failed
assertion fails the job. Browser failure artifacts include screenshots and traces.

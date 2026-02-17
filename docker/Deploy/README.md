# GundraBot Deployment

This folder contains the production deployment configuration:

- `Dockerfile.deploy`
- `docker-compose.deploy.yml`

## Prerequisites

1. Docker Desktop (or Docker Engine with Compose plugin) installed.
2. Project root contains a valid `.env` file.
3. Project root contains:
   - `secrets/` (for files like `yt-cookies.txt`)
   - `logs/` (for persistent bot logs)

## Deploy

Run from the project root:

```bash
docker compose -f docker/Deploy/docker-compose.deploy.yml up -d --build
```

## Logs

```bash
docker compose -f docker/Deploy/docker-compose.deploy.yml logs -f
```

## Stop

```bash
docker compose -f docker/Deploy/docker-compose.deploy.yml down
```

## Rebuild After Changes

```bash
docker compose -f docker/Deploy/docker-compose.deploy.yml up -d --build --force-recreate
```

## Automatic yt-cookies Refresh

The bot now runs a cron-like background refresh using yt-dlp while the container is running.
This helps keep `secrets/yt-cookies.txt` active even when no one uses music commands.

Configure in `.env`:

```env
YTDLP_COOKIES=/usr/src/app/secrets/yt-cookies.txt
YTDLP_COOKIE_REFRESH_ENABLED=true
YTDLP_COOKIE_REFRESH_INTERVAL_MINUTES=360
YTDLP_COOKIE_REFRESH_URL=https://www.youtube.com/watch?v=BaW_jenozKc
```

Important: if Google fully invalidates the session, automation cannot re-login for you.
In that case, re-export `yt-cookies.txt` manually.

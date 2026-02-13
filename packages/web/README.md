# @argus-vrt/web

**CLI tool for deploying and managing the Argus web dashboard.**

The Argus web dashboard is a self-hosted review interface for visual regression test results — similar to Chromatic, but self-hosted. This package provides an interactive CLI to set up and manage the dashboard via Docker.

## Quick Start

```bash
# Run the interactive setup wizard
npx @argus-vrt/web init

# Start the dashboard
npx @argus-vrt/web start

# Open http://localhost:3000
```

The `init` wizard generates a `docker-compose.yml`, `.env`, and optionally `nginx.conf` in an `./argus/` directory.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running
- Node.js >= 20 (for running the CLI via npx)

## Commands

### `npx @argus-vrt/web init`

Interactive setup wizard. Prompts for:

- **PostgreSQL** — include a container (recommended) or use an external instance
- **Port** — default 3000
- **Domain** — custom domain or localhost
- **HTTPS** — Let's Encrypt, custom certificate, or none
- **Reverse proxy** — include an Nginx container or manage yourself
- **Screenshots path** — where uploaded screenshots are stored

Generates configuration files into `./argus/` (or `--dir <path>`).

### `npx @argus-vrt/web start`

Start Argus containers (`docker compose up -d`).

### `npx @argus-vrt/web stop`

Stop Argus containers (`docker compose down`).

### `npx @argus-vrt/web logs`

Stream container logs (`docker compose logs -f`).

```bash
npx @argus-vrt/web logs --service web    # only web container
npx @argus-vrt/web logs --service db     # only database
```

### `npx @argus-vrt/web status`

Show container status and run a health check on the web dashboard.

### `npx @argus-vrt/web upgrade`

Pull the latest Docker images and restart containers.

```bash
npx @argus-vrt/web upgrade
```

## Options

All management commands (`start`, `stop`, `logs`, `status`, `upgrade`) accept:

| Flag | Description |
|------|-------------|
| `-d, --dir <path>` | Path to the Argus directory (default: `./argus`) |

## Connecting the CLI

Once the dashboard is running, point the testing CLI at it by adding `apiUrl` to your project's `.argus.json`:

```json
{
  "apiUrl": "http://localhost:3000"
}
```

Then upload results after running tests:

```bash
npx argus test
```

## Environment Variables

The generated `.env` file supports:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | (auto) | PostgreSQL connection string (external DB only) |
| `DB_PASSWORD` | `argus` | Database password (container DB only) |
| `SCREENSHOTS_PATH` | `./argus-data/images` | Path to screenshots directory |

## Docker Image

The web dashboard is distributed as a Docker image on GitHub Container Registry:

```
ghcr.io/maxcwolf/argus-web:latest
```

## License

MIT

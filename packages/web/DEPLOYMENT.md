# Deploying Argus Web Dashboard

## Quick Start (Recommended)

The easiest way to deploy Argus is with the CLI:

```bash
# Interactive setup wizard
npx @argus-vrt/web init

# Start the dashboard
npx @argus-vrt/web start
```

The `init` wizard generates `docker-compose.yml`, `.env`, and optionally `nginx.conf` with your chosen settings. See the [README](./README.md) for all CLI commands.

### Authentication Setup

Before running `init`, create a **GitHub OAuth App**:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **New OAuth App**
2. Set the **Authorization callback URL** to `https://your-domain.com/auth/github/callback`
3. Save the **Client ID** and generate a **Client Secret**

The `init` wizard will prompt for these values and auto-generate a session secret and API key.

---

## Manual Docker Deployment

If you prefer to set things up manually, the web dashboard is available as a Docker image:

```
ghcr.io/maxcwolf/argus-web:latest
```

### Docker Compose Example

```yaml
services:
  web:
    image: ghcr.io/maxcwolf/argus-web:latest
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - DATABASE_URL=postgresql://argus:${DB_PASSWORD:-argus}@db:5432/argus
      - NODE_ENV=production
      - GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
      - GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - ARGUS_API_KEY=${ARGUS_API_KEY}
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ${SCREENSHOTS_PATH:-./screenshots}:/screenshots:ro
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: argus
      POSTGRES_PASSWORD: ${DB_PASSWORD:-argus}
      POSTGRES_DB: argus
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U argus"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### Configuration

Create a `.env` file:

```bash
PORT=3000
DB_PASSWORD=your-secure-password
SCREENSHOTS_PATH=/path/to/your/screenshots

# GitHub OAuth (required)
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# Session encryption (generate with: openssl rand -hex 32)
SESSION_SECRET=your-random-secret

# API key for CI/CD uploads (generate with: openssl rand -hex 32)
ARGUS_API_KEY=your-api-key
```

### Image Serving

The dashboard needs access to screenshot files. Mount the directory into the container:

```yaml
volumes:
  - /Users/yourname/projects:/screenshots:ro
```

Images at `/Users/yourname/projects/app/.visual-screenshots/...` will be served.

For team setups, mount a shared NFS/SMB volume:

```yaml
volumes:
  - type: nfs
    source: your-nfs-server:/screenshots
    target: /screenshots
```

### Production with Reverse Proxy (Nginx)

For HTTPS and domain setup:

```nginx
server {
    listen 80;
    server_name argus.yourcompany.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name argus.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/argus.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/argus.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Or use `npx @argus-vrt/web init` with a domain to generate this automatically, then run `npx @argus-vrt/web setup-ssl <domain>` to obtain a Let's Encrypt certificate.

---

## Managing Your Deployment

### With the CLI

```bash
npx @argus-vrt/web start       # Start containers
npx @argus-vrt/web stop        # Stop containers
npx @argus-vrt/web logs        # Stream logs
npx @argus-vrt/web status      # Health check
npx @argus-vrt/web upgrade     # Pull latest image + restart
npx @argus-vrt/web setup-ssl <domain>  # Obtain Let's Encrypt certificate
```

### Manual Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f web

# Pull latest and restart
docker compose pull && docker compose up -d
```

### Backup Database

```bash
# Backup
docker compose exec db pg_dump -U argus argus > backup.sql

# Restore
docker compose exec -T db psql -U argus argus < backup.sql
```

---

## CI/CD Upload Authentication

The `/api/upload` endpoint requires an API key. Pass it via the `Authorization` header:

```bash
curl -X POST https://your-domain.com/api/upload \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"branch":"main","commitHash":"abc123","stories":[...]}'
```

If using the Argus CLI, add `apiKey` to your `.argus.json`:

```json
{
  "apiUrl": "https://your-domain.com",
  "apiKey": "your-api-key"
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port for the web server |
| `DATABASE_URL` | (auto) | PostgreSQL connection string |
| `DB_PASSWORD` | `argus` | Database password |
| `SCREENSHOTS_PATH` | `./screenshots` | Path to mount for image serving |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth App client secret |
| `SESSION_SECRET` | — | Encryption key for session cookies |
| `ARGUS_API_KEY` | — | API key for CI/CD upload authentication |
| `NODE_ENV` | `production` | Node environment |
